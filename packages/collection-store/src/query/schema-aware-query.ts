// Schema-aware query builder for Collection Store
// Integrates field type validation with query building

import { build_query_new } from './build_query'
import { compileQuery } from './compile_query'
import {
  SchemaDefinition,
  FieldValidator,
  createFieldValidator,
  detectBSONType,
  validateOperator,
  BSONType
} from '../types/field-types'

export interface QueryValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  processedQuery?: any
}

export interface SchemaAwareQueryOptions {
  validateTypes?: boolean
  coerceValues?: boolean
  strictMode?: boolean
  allowUnknownFields?: boolean
}

export class SchemaAwareQueryBuilder {
  private schema: SchemaDefinition
  private validator: FieldValidator
  private options: SchemaAwareQueryOptions

  constructor(schema: SchemaDefinition, options: SchemaAwareQueryOptions = {}) {
    this.schema = schema
    this.validator = createFieldValidator(schema)
    this.options = {
      validateTypes: true,
      coerceValues: true,
      strictMode: false,
      allowUnknownFields: true,
      ...options
    }
  }

  // Validate query against schema
  validateQuery(query: any): QueryValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    let processedQuery = { ...query }

    try {
      const result = this.validateQueryRecursive(processedQuery, '')
      errors.push(...result.errors)
      warnings.push(...result.warnings)
      processedQuery = result.processedQuery || processedQuery
    } catch (error: any) {
      errors.push(`Query validation failed: ${error.message}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      processedQuery: errors.length === 0 ? processedQuery : undefined
    }
  }

  // Build query function with schema validation
  // By default uses compiled mode for performance
  buildQuery(query: any, options: { interpreted?: boolean } = {}): {
    queryFn: (doc: any) => boolean
    validation: QueryValidationResult
  } {
    const validation = this.validateQuery(query)

    if (!validation.valid && this.options.strictMode) {
      throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`)
    }

    const queryToUse = validation.processedQuery || query

    // Use compiled mode by default, interpreted mode for debugging
    if (options.interpreted) {
      const queryFn = build_query_new(queryToUse)
      return { queryFn, validation }
    }

    // Try compiled mode first
    try {
      const compiledResult = compileQuery(queryToUse)
      if (compiledResult.func) {
        return { queryFn: compiledResult.func, validation }
      } else {
        // Fall back to interpreted mode
        console.warn('Schema-aware query compilation failed, falling back to interpreted mode:', compiledResult.error)
        const queryFn = build_query_new(queryToUse)
        return { queryFn, validation }
      }
    } catch (error: any) {
      // Fall back to interpreted mode
      console.warn('Schema-aware query compilation error, falling back to interpreted mode:', error.message)
      const queryFn = build_query_new(queryToUse)
      return { queryFn, validation }
    }
  }

  // Compile query with schema validation
  compileQuery(query: any): {
    compiledResult: any
    validation: QueryValidationResult
  } {
    const validation = this.validateQuery(query)

    if (!validation.valid && this.options.strictMode) {
      throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`)
    }

    const queryToUse = validation.processedQuery || query
    const compiledResult = compileQuery(queryToUse)

    return { compiledResult, validation }
  }

  // Validate document against schema
  validateDocument(doc: any) {
    return this.validator.validateDocument(doc)
  }

  // Get field type from schema
  getFieldType(fieldPath: string): BSONType | BSONType[] | undefined {
    return this.schema[fieldPath]?.type
  }

  // Check if field exists in schema
  hasField(fieldPath: string): boolean {
    return fieldPath in this.schema
  }

  // Get schema definition
  getSchema(): SchemaDefinition {
    return { ...this.schema }
  }

  // Private recursive validation method
  private validateQueryRecursive(query: any, currentPath: string): {
    processedQuery: any
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    let processedQuery = { ...query }

    if (typeof query !== 'object' || query === null) {
      return { processedQuery, errors, warnings }
    }

    for (const [key, value] of Object.entries(query)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key

      // Handle logical operators
      if (key.startsWith('$') && ['$and', '$or', '$nor'].includes(key)) {
        if (Array.isArray(value)) {
          const processedArray = value.map(subQuery => {
            const result = this.validateQueryRecursive(subQuery, currentPath)
            errors.push(...result.errors)
            warnings.push(...result.warnings)
            return result.processedQuery
          })
          processedQuery[key] = processedArray
        }
        continue
      }

      // Handle field-level operators
      if (key.startsWith('$')) {
        // This is an operator at field level, validate against current field type
        const fieldType = this.getFieldTypeForPath(currentPath)
        if (fieldType && this.options.validateTypes) {
          const validation = this.validateOperatorForType(key, fieldType, value)
          if (!validation.valid) {
            if (this.options.strictMode) {
              errors.push(validation.error!)
            } else {
              warnings.push(validation.error!)
            }
          }
        }
        continue
      }

      // Handle nested objects (field paths)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check if this is a field with operators
        const hasOperators = Object.keys(value).some(k => k.startsWith('$'))

        if (hasOperators) {
          // This is a field with operators like { age: { $gt: 30 } }
          const fieldType = this.getFieldTypeForPath(fieldPath)

          if (fieldType && this.options.validateTypes) {
            for (const [operator, operatorValue] of Object.entries(value)) {
              if (operator.startsWith('$')) {
                const validation = this.validateOperatorForType(operator, fieldType, operatorValue)
                if (!validation.valid) {
                  if (this.options.strictMode) {
                    errors.push(`Field '${fieldPath}': ${validation.error}`)
                  } else {
                    warnings.push(`Field '${fieldPath}': ${validation.error}`)
                  }
                }
              }
            }
          }
        } else {
          // This is a nested object, recurse
          const result = this.validateQueryRecursive(value, fieldPath)
          errors.push(...result.errors)
          warnings.push(...result.warnings)
          processedQuery[key] = result.processedQuery
        }
      } else {
        // This is a direct field value like { name: "John" }
        const fieldType = this.getFieldTypeForPath(fieldPath)

        if (fieldType && this.options.validateTypes) {
          const validation = this.validateFieldValue(fieldPath, value)
          if (!validation.valid) {
            if (this.options.strictMode) {
              errors.push(validation.error!)
            } else {
              warnings.push(validation.error!)
            }
          } else if (validation.coercedValue !== value && this.options.coerceValues) {
            processedQuery[key] = validation.coercedValue
            if (validation.warnings) {
              warnings.push(...validation.warnings)
            }
          }
        } else if (!this.options.allowUnknownFields && !this.hasField(fieldPath)) {
          const message = `Unknown field '${fieldPath}' not defined in schema`
          if (this.options.strictMode) {
            errors.push(message)
          } else {
            warnings.push(message)
          }
        }
      }
    }

    return { processedQuery, errors, warnings }
  }

  // Get field type for a given path (supports nested paths)
  private getFieldTypeForPath(fieldPath: string): BSONType | BSONType[] | undefined {
    // Try exact match first
    if (this.schema[fieldPath]) {
      return this.schema[fieldPath].type
    }

    // Try parent paths for nested fields
    const parts = fieldPath.split('.')
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join('.')
      if (this.schema[parentPath]) {
        const parentType = this.schema[parentPath].type
        // If parent is object or array, we can't determine nested type
        if (Array.isArray(parentType)) {
          if (parentType.includes('object') || parentType.includes('array')) {
            return undefined // Unknown nested type
          }
        } else if (parentType === 'object' || parentType === 'array') {
          return undefined // Unknown nested type
        }
      }
    }

    return undefined
  }

  // Validate operator usage for specific field type
  private validateOperatorForType(operator: string, fieldType: BSONType | BSONType[], value: any) {
    const types = Array.isArray(fieldType) ? fieldType : [fieldType]

    // Check each possible type
    for (const type of types) {
      const validation = validateOperator(operator, type, value)
      if (validation.valid) {
        return validation // If any type is compatible, it's valid
      }
    }

    // If none are compatible, return error for the first type
    return validateOperator(operator, types[0], value)
  }

  // Validate field value
  private validateFieldValue(fieldPath: string, value: any) {
    return this.validator.validateField(fieldPath, value)
  }
}

// Utility function to create schema-aware query builder
export function createSchemaAwareQuery(
  schema: SchemaDefinition,
  options?: SchemaAwareQueryOptions
): SchemaAwareQueryBuilder {
  return new SchemaAwareQueryBuilder(schema, options)
}

// Helper to infer schema from sample data
export function inferSchemaFromData(data: any[]): SchemaDefinition {
  const schema: SchemaDefinition = {}

  if (data.length === 0) return schema

  // Analyze all records to infer types
  const fieldTypes: Record<string, Set<BSONType>> = {}

  for (const record of data) {
    analyzeObject(record, '', fieldTypes)
  }

  // Convert to schema definition
  for (const [fieldPath, types] of Object.entries(fieldTypes)) {
    const typeArray = Array.from(types)
    schema[fieldPath] = {
      type: typeArray.length === 1 ? typeArray[0] : typeArray,
      required: false, // Can't infer required from sample data
      coerce: true // Default to allowing coercion
    }
  }

  return schema
}

// Helper to recursively analyze object structure
function analyzeObject(obj: any, prefix: string, fieldTypes: Record<string, Set<BSONType>>) {
  if (obj === null || obj === undefined) return

  if (typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key

      if (!fieldTypes[fieldPath]) {
        fieldTypes[fieldPath] = new Set()
      }

      const type = detectBSONType(value)
      fieldTypes[fieldPath].add(type)

      // Recurse for nested objects
      if (type === 'object') {
        analyzeObject(value, fieldPath, fieldTypes)
      }
    }
  }
}