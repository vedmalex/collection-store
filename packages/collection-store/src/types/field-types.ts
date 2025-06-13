// Field Type System for Collection Store
// Based on MongoDB BSON types and type coercion rules
import { getJsType } from '../query/js_types'

// Extended BSON types based on MongoDB specification
export type BSONType =
  | 'null'
  | 'undefined'
  | 'number'
  | 'double'
  | 'int'
  | 'long'
  | 'string'
  | 'object'
  | 'array'
  | 'boolean'
  | 'date'
  | 'regex'
  | 'regexp'
  | 'objectId'
  | 'binary'
  | 'binData'
  | 'buffer'

export type FieldTypeDefinition = {
  type: BSONType | BSONType[]
  required?: boolean
  default?: any
  coerce?: boolean // Auto-convert compatible types
  strict?: boolean // Strict type checking
  validator?: (value: any) => boolean
  description?: string
}

export type SchemaDefinition = {
  [fieldPath: string]: FieldTypeDefinition
}

// Type detection utility - unified with existing js_types.ts
export function detectBSONType(value: unknown): BSONType {
  const jsType = getJsType(value)

  // Map js_types to BSON types
  switch (jsType) {
    case 'null': return 'null'
    case 'undefined': return 'undefined'
    case 'number':
      // Distinguish between int and double
      return typeof value === 'number' && Number.isInteger(value) ? 'int' : 'double'
    case 'string': return 'string'
    case 'boolean': return 'boolean'
    case 'date': return 'date'
    case 'regexp': return 'regex'
    case 'array': return 'array'
    case 'buffer': return 'binary'
    case 'object': return 'object'
    default: return 'object' // fallback
  }
}

// Type coercion utilities
export class TypeCoercion {
  static toString(value: any): string | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value.toString()
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return JSON.stringify(value)
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  static toNumber(value: any): number | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'string') {
      const parsed = Number(value)
      return isNaN(parsed) ? null : parsed
    }
    if (value instanceof Date) return value.getTime()
    return null
  }

  static toBoolean(value: any): boolean | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'true' || lower === '1') return true
      if (lower === 'false' || lower === '0') return false
      return null
    }
    return Boolean(value)
  }

  static toDate(value: any): Date | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) return value
    if (typeof value === 'number') return new Date(value)
    if (typeof value === 'string') {
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? null : parsed
    }
    return null
  }

  static toArray(value: any): any[] | null {
    if (value === null || value === undefined) return null
    if (Array.isArray(value)) return value
    return [value] // Single value becomes array
  }
}

// Type compatibility checker
export class TypeCompatibility {
  // Check if a value is compatible with expected type(s)
  static isCompatible(value: any, expectedTypes: BSONType | BSONType[]): boolean {
    const actualType = detectBSONType(value)
    const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes]

    return types.includes(actualType) || this.canCoerce(actualType, types)
  }

  // Check if type can be coerced to target types
  static canCoerce(sourceType: BSONType, targetTypes: BSONType[]): boolean {
    const coercionRules: Record<BSONType, BSONType[]> = {
      'string': ['number', 'double', 'int', 'long', 'boolean', 'date'],
      'number': ['string', 'boolean', 'date', 'double', 'int', 'long'],
      'double': ['string', 'boolean', 'date', 'number', 'int', 'long'],
      'int': ['string', 'boolean', 'date', 'number', 'double', 'long'],
      'long': ['string', 'boolean', 'date', 'number', 'double', 'int'],
      'boolean': ['string', 'number', 'double', 'int', 'long'],
      'date': ['string', 'number', 'double', 'int', 'long'],
      'null': [], // null can't be coerced
      'undefined': [], // undefined can't be coerced
      'array': [], // arrays generally don't coerce
      'object': ['string'], // objects can be stringified
      'regex': ['string'],
      'regexp': ['string'],
      'objectId': ['string'],
      'binary': ['string'],
      'binData': ['string'],
      'buffer': ['string']
    }

    return targetTypes.some(target =>
      coercionRules[sourceType]?.includes(target)
    )
  }

  // Get coerced value
  static coerceValue(value: any, targetType: BSONType): any {
    switch (targetType) {
      case 'string': return TypeCoercion.toString(value)
      case 'number':
      case 'double':
      case 'int':
      case 'long': return TypeCoercion.toNumber(value)
      case 'boolean': return TypeCoercion.toBoolean(value)
      case 'date': return TypeCoercion.toDate(value)
      case 'array': return TypeCoercion.toArray(value)
      default: return value
    }
  }
}

// Field validator
export class FieldValidator {
  private schema: SchemaDefinition

  constructor(schema: SchemaDefinition) {
    this.schema = schema
  }

  // Validate a single field
  validateField(fieldPath: string, value: any): {
    valid: boolean
    coercedValue?: any
    error?: string
    warnings?: string[]
  } {
    const fieldDef = this.schema[fieldPath]
    if (!fieldDef) {
      return { valid: true, coercedValue: value } // No schema = allow anything
    }

    const warnings: string[] = []
    let coercedValue = value

    // Check required
    if (fieldDef.required && (value === null || value === undefined)) {
      return {
        valid: false,
        error: `Field '${fieldPath}' is required but got ${value}`
      }
    }

    // Handle null/undefined with default
    if ((value === null || value === undefined) && fieldDef.default !== undefined) {
      coercedValue = fieldDef.default
    }

    // Skip further validation for null/undefined if not required
    if (coercedValue === null || coercedValue === undefined) {
      return { valid: true, coercedValue, warnings }
    }

    // Type checking
    const actualType = detectBSONType(coercedValue)
    const expectedTypes = Array.isArray(fieldDef.type) ? fieldDef.type : [fieldDef.type]

    if (!expectedTypes.includes(actualType)) {
      // Try coercion if allowed
      if (fieldDef.coerce !== false) {
        let coerced = false
        for (const targetType of expectedTypes) {
          if (TypeCompatibility.canCoerce(actualType, [targetType])) {
            const newValue = TypeCompatibility.coerceValue(coercedValue, targetType)
            if (newValue !== null) {
              coercedValue = newValue
              coerced = true
              warnings.push(`Coerced ${actualType} to ${targetType} for field '${fieldPath}'`)
              break
            }
          }
        }

        if (!coerced && fieldDef.strict) {
          return {
            valid: false,
            error: `Field '${fieldPath}' expected ${expectedTypes.join(' or ')} but got ${actualType}`
          }
        }
      } else if (fieldDef.strict) {
        return {
          valid: false,
          error: `Field '${fieldPath}' expected ${expectedTypes.join(' or ')} but got ${actualType}`
        }
      }
    }

    // Custom validator
    if (fieldDef.validator && !fieldDef.validator(coercedValue)) {
      return {
        valid: false,
        error: `Field '${fieldPath}' failed custom validation`
      }
    }

    return { valid: true, coercedValue, warnings }
  }

  // Validate entire document
  validateDocument(doc: any): {
    valid: boolean
    processedDoc?: any
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    const processedDoc = { ...doc }

    // Validate each field in schema
    for (const fieldPath of Object.keys(this.schema)) {
      const value = this.getNestedValue(doc, fieldPath)
      const result = this.validateField(fieldPath, value)

      if (!result.valid) {
        errors.push(result.error!)
      } else {
        if (result.coercedValue !== value) {
          this.setNestedValue(processedDoc, fieldPath, result.coercedValue)
        }
        if (result.warnings) {
          warnings.push(...result.warnings)
        }
      }
    }

    return {
      valid: errors.length === 0,
      processedDoc: errors.length === 0 ? processedDoc : undefined,
      errors,
      warnings
    }
  }

  // Helper to get nested value by path
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) =>
      current && typeof current === 'object' ? current[key] : undefined, obj
    )
  }

  // Helper to set nested value by path
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key]
    }, obj)
    target[lastKey] = value
  }
}

// Operator type compatibility checker
export class OperatorTypeChecker {
  // Define which operators work with which types
  private static operatorTypeMap: Record<string, BSONType[]> = {
    // Comparison operators
    '$eq': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object'],
    '$ne': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object'],
    '$gt': ['number', 'double', 'int', 'long', 'string', 'date'],
    '$gte': ['number', 'double', 'int', 'long', 'string', 'date'],
    '$lt': ['number', 'double', 'int', 'long', 'string', 'date'],
    '$lte': ['number', 'double', 'int', 'long', 'string', 'date'],
    '$in': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object'],
    '$nin': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object'],

    // String operators
    '$regex': ['string'],
    '$text': ['string'],

    // Array operators
    '$all': ['array'],
    '$size': ['array'],
    '$elemMatch': ['array'],

    // Bitwise operators
    '$bitsAllSet': ['number', 'double', 'int', 'long'],
    '$bitsAnySet': ['number', 'double', 'int', 'long'],
    '$bitsAllClear': ['number', 'double', 'int', 'long'],
    '$bitsAnyClear': ['number', 'double', 'int', 'long'],

    // Type operators
    '$type': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object', 'regex', 'regexp', 'binary', 'binData', 'buffer', 'objectId'],
    '$exists': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object', 'regex', 'regexp', 'binary', 'binData', 'buffer', 'objectId'],

    // Math operators
    '$mod': ['number', 'double', 'int', 'long'],

    // Evaluation operators
    '$where': ['null', 'undefined', 'number', 'double', 'int', 'long', 'string', 'boolean', 'date', 'array', 'object'],
  }

  static isOperatorCompatible(operator: string, fieldType: BSONType): boolean {
    const supportedTypes = this.operatorTypeMap[operator]
    return supportedTypes ? supportedTypes.includes(fieldType) : true
  }

  static getIncompatibleOperators(fieldType: BSONType): string[] {
    return Object.entries(this.operatorTypeMap)
      .filter(([_, types]) => !types.includes(fieldType))
      .map(([op, _]) => op)
  }

  static validateOperatorUsage(operator: string, fieldType: BSONType, queryValue: any): {
    valid: boolean
    error?: string
    suggestion?: string
  } {
    if (!this.isOperatorCompatible(operator, fieldType)) {
      return {
        valid: false,
        error: `Operator ${operator} is not compatible with field type ${fieldType}`,
        suggestion: `Consider using operators: ${this.operatorTypeMap[operator]?.join(', ') || 'none available'}`
      }
    }

    // Additional specific validations
    switch (operator) {
      case '$regex':
        if (typeof queryValue !== 'string' && !(queryValue instanceof RegExp)) {
          return {
            valid: false,
            error: '$regex requires string or RegExp value'
          }
        }
        break

      case '$bitsAllSet':
      case '$bitsAnySet':
      case '$bitsAllClear':
      case '$bitsAnyClear':
        if (typeof queryValue !== 'number' && !Array.isArray(queryValue)) {
          return {
            valid: false,
            error: `${operator} requires number or array of bit positions`
          }
        }
        break

      case '$size':
        if (typeof queryValue !== 'number' || queryValue < 0) {
          return {
            valid: false,
            error: '$size requires non-negative number'
          }
        }
        break
    }

    return { valid: true }
  }
}

// Export utility functions
export function createFieldValidator(schema: SchemaDefinition): FieldValidator {
  return new FieldValidator(schema)
}

export function validateOperator(operator: string, fieldType: BSONType, queryValue: any) {
  return OperatorTypeChecker.validateOperatorUsage(operator, fieldType, queryValue)
}