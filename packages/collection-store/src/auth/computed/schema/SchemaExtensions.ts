import type { ComputedAttributeDefinition } from '../types'
import { ComputedAttributeErrorFactory, ComputedAttributeErrorCodeDetailed } from '../types/ErrorTypes'

/**
 * Base collection schema interface
 */
export interface BaseCollectionSchema {
  name: string
  fields: Record<string, FieldDefinition>
  indexes?: IndexDefinition[]
  constraints?: ConstraintDefinition[]
  metadata?: Record<string, any>
}

/**
 * Field definition in collection schema
 */
export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'reference'
  required?: boolean
  default?: any
  validation?: ValidationRule[]
  description?: string
  metadata?: Record<string, any>
}

/**
 * Index definition
 */
export interface IndexDefinition {
  name: string
  fields: string[]
  unique?: boolean
  sparse?: boolean
  type?: 'btree' | 'hash' | 'text' | 'geo'
  options?: Record<string, any>
}

/**
 * Constraint definition
 */
export interface ConstraintDefinition {
  name: string
  type: 'unique' | 'check' | 'foreign_key' | 'not_null'
  fields: string[]
  expression?: string
  reference?: {
    collection: string
    field: string
  }
}

/**
 * Validation rule
 */
export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom'
  value?: any
  message?: string
  validator?: (value: any) => boolean | Promise<boolean>
}

/**
 * Computed attribute schema definition
 */
export interface ComputedAttributeSchema {
  id: string
  name: string
  description?: string
  targetType: 'user' | 'document' | 'collection' | 'database'
  returnType: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'
  dependencies: ComputedAttributeDependencySchema[]
  security: ComputedAttributeSecuritySchema
  caching: ComputedAttributeCachingSchema
  validation?: ValidationRule[]
  metadata?: Record<string, any>
}

/**
 * Computed attribute dependency schema
 */
export interface ComputedAttributeDependencySchema {
  type: 'field' | 'collection' | 'external_api' | 'system' | 'computed_attribute'
  source: string
  targetType?: 'user' | 'document' | 'collection' | 'database'
  invalidateOnChange: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  condition?: string // JavaScript expression
}

/**
 * Computed attribute security schema
 */
export interface ComputedAttributeSecuritySchema {
  requiredRoles?: string[]
  requiredPermissions?: string[]
  allowedContexts?: ('user' | 'system' | 'api' | 'internal')[]
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted'
  auditLevel?: 'none' | 'basic' | 'detailed' | 'full'
}

/**
 * Computed attribute caching schema
 */
export interface ComputedAttributeCachingSchema {
  enabled: boolean
  ttl?: number // seconds
  strategy?: 'lru' | 'lfu' | 'fifo' | 'custom'
  maxSize?: number
  invalidationTriggers?: string[]
}

/**
 * Extended collection schema with computed attributes
 */
export interface CollectionSchemaWithComputedAttributes extends BaseCollectionSchema {
  computedAttributes?: Record<string, ComputedAttributeSchema>
  computedAttributeConfig?: {
    enabled: boolean
    defaultCaching?: ComputedAttributeCachingSchema
    defaultSecurity?: ComputedAttributeSecuritySchema
    maxComputedAttributes?: number
    computationTimeout?: number
  }
}

/**
 * Schema extension configuration
 */
export interface SchemaExtensionConfig {
  enableComputedAttributes: boolean
  enableValidation: boolean
  enableSecurityChecks: boolean
  enableCaching: boolean
  maxAttributesPerCollection: number
  defaultComputationTimeout: number
  enableAuditLogging: boolean
}

/**
 * Default schema extension configuration
 */
export const DEFAULT_SCHEMA_EXTENSION_CONFIG: SchemaExtensionConfig = {
  enableComputedAttributes: true,
  enableValidation: true,
  enableSecurityChecks: true,
  enableCaching: true,
  maxAttributesPerCollection: 50,
  defaultComputationTimeout: 5000, // 5 seconds
  enableAuditLogging: true
}

/**
 * Schema extension result
 */
export interface SchemaExtensionResult {
  success: boolean
  extendedSchema?: CollectionSchemaWithComputedAttributes
  errors: string[]
  warnings: string[]
  addedAttributes: string[]
  modifiedFields: string[]
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  isValid: boolean
  errors: SchemaValidationError[]
  warnings: SchemaValidationWarning[]
  suggestions: string[]
}

/**
 * Schema validation error
 */
export interface SchemaValidationError {
  type: 'field_conflict' | 'invalid_dependency' | 'security_violation' | 'constraint_violation' | 'type_mismatch'
  field?: string
  attributeId?: string
  message: string
  severity: 'error' | 'warning'
  suggestion?: string
}

/**
 * Schema validation warning
 */
export interface SchemaValidationWarning {
  type: 'performance_concern' | 'security_recommendation' | 'best_practice' | 'deprecation'
  field?: string
  attributeId?: string
  message: string
  recommendation?: string
}

/**
 * Schema extension utilities
 */
export class SchemaExtensions {
  private config: SchemaExtensionConfig

  constructor(config: Partial<SchemaExtensionConfig> = {}) {
    this.config = { ...DEFAULT_SCHEMA_EXTENSION_CONFIG, ...config }
  }

  /**
   * Extend collection schema with computed attributes
   */
  async extendSchema(
    baseSchema: BaseCollectionSchema,
    computedAttributes: ComputedAttributeDefinition[]
  ): Promise<SchemaExtensionResult> {
    const result: SchemaExtensionResult = {
      success: false,
      errors: [],
      warnings: [],
      addedAttributes: [],
      modifiedFields: []
    }

    try {
      // Validate base schema
      const baseValidation = await this.validateBaseSchema(baseSchema)
      if (!baseValidation.isValid) {
        result.errors.push(...baseValidation.errors.map(e => e.message))
        return result
      }

      // Check computed attributes limit
      if (computedAttributes.length > this.config.maxAttributesPerCollection) {
        result.errors.push(
          `Too many computed attributes: ${computedAttributes.length} > ${this.config.maxAttributesPerCollection}`
        )
        return result
      }

      // Convert computed attributes to schema format
      const computedAttributeSchemas: Record<string, ComputedAttributeSchema> = {}

      for (const attr of computedAttributes) {
        const schemaAttr = await this.convertToSchemaFormat(attr)

        // Validate attribute
        const attrValidation = await this.validateComputedAttribute(schemaAttr, baseSchema)
        if (!attrValidation.isValid) {
          result.errors.push(...attrValidation.errors.map(e => e.message))
          continue
        }

        computedAttributeSchemas[attr.id] = schemaAttr
        result.addedAttributes.push(attr.id)

        // Add warnings
        result.warnings.push(...attrValidation.warnings.map(w => w.message))
      }

      if (result.errors.length > 0) {
        return result
      }

      // Create extended schema
      const extendedSchema: CollectionSchemaWithComputedAttributes = {
        ...baseSchema,
        computedAttributes: computedAttributeSchemas,
        computedAttributeConfig: {
          enabled: this.config.enableComputedAttributes,
          defaultCaching: {
            enabled: this.config.enableCaching,
            ttl: 300, // 5 minutes
            strategy: 'lru'
          },
          defaultSecurity: {
            allowedContexts: ['user', 'api'],
            dataClassification: 'internal',
            auditLevel: this.config.enableAuditLogging ? 'basic' : 'none'
          },
          maxComputedAttributes: this.config.maxAttributesPerCollection,
          computationTimeout: this.config.defaultComputationTimeout
        }
      }

      result.success = true
      result.extendedSchema = extendedSchema

      return result

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during schema extension')
      return result
    }
  }

  /**
   * Validate base collection schema
   */
  async validateBaseSchema(schema: BaseCollectionSchema): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Check required fields
    if (!schema.name || schema.name.trim() === '') {
      result.errors.push({
        type: 'constraint_violation',
        message: 'Collection name is required',
        severity: 'error'
      })
      result.isValid = false
    }

    if (!schema.fields || Object.keys(schema.fields).length === 0) {
      result.errors.push({
        type: 'constraint_violation',
        message: 'Collection must have at least one field',
        severity: 'error'
      })
      result.isValid = false
    }

    // Validate field definitions
    for (const [fieldName, fieldDef] of Object.entries(schema.fields || {})) {
      if (!fieldDef.type) {
        result.errors.push({
          type: 'type_mismatch',
          field: fieldName,
          message: `Field '${fieldName}' must have a type`,
          severity: 'error'
        })
        result.isValid = false
      }

      // Check for reserved field names
      if (this.isReservedFieldName(fieldName)) {
        result.warnings.push({
          type: 'best_practice',
          field: fieldName,
          message: `Field name '${fieldName}' is reserved and may cause conflicts`,
          recommendation: 'Consider using a different field name'
        })
      }
    }

    // Validate indexes
    if (schema.indexes) {
      for (const index of schema.indexes) {
        if (!index.name || !index.fields || index.fields.length === 0) {
          result.errors.push({
            type: 'constraint_violation',
            message: 'Index must have a name and at least one field',
            severity: 'error'
          })
          result.isValid = false
        }

        // Check if indexed fields exist
        for (const fieldName of index.fields) {
          if (!schema.fields[fieldName]) {
            result.errors.push({
              type: 'field_conflict',
              field: fieldName,
              message: `Index references non-existent field '${fieldName}'`,
              severity: 'error'
            })
            result.isValid = false
          }
        }
      }
    }

    return result
  }

  /**
   * Validate computed attribute against schema
   */
  async validateComputedAttribute(
    attribute: ComputedAttributeSchema,
    baseSchema: BaseCollectionSchema
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Check for field name conflicts
    if (baseSchema.fields[attribute.id]) {
      result.errors.push({
        type: 'field_conflict',
        attributeId: attribute.id,
        field: attribute.id,
        message: `Computed attribute '${attribute.id}' conflicts with existing field`,
        severity: 'error',
        suggestion: 'Use a different attribute ID or rename the existing field'
      })
      result.isValid = false
    }

    // Validate dependencies
    for (const dep of attribute.dependencies) {
      if (dep.type === 'field' && !baseSchema.fields[dep.source]) {
        result.errors.push({
          type: 'invalid_dependency',
          attributeId: attribute.id,
          message: `Dependency references non-existent field '${dep.source}'`,
          severity: 'error'
        })
        result.isValid = false
      }

      if (dep.type === 'computed_attribute' && dep.source === attribute.id) {
        result.errors.push({
          type: 'invalid_dependency',
          attributeId: attribute.id,
          message: 'Computed attribute cannot depend on itself',
          severity: 'error'
        })
        result.isValid = false
      }
    }

    // Security validation
    if (this.config.enableSecurityChecks) {
      if (!attribute.security.dataClassification) {
        result.warnings.push({
          type: 'security_recommendation',
          attributeId: attribute.id,
          message: 'Data classification not specified',
          recommendation: 'Specify data classification for better security'
        })
      }

      if (attribute.security.dataClassification === 'restricted' &&
          !attribute.security.requiredRoles?.length) {
        result.warnings.push({
          type: 'security_recommendation',
          attributeId: attribute.id,
          message: 'Restricted data should require specific roles',
          recommendation: 'Add required roles for restricted data access'
        })
      }
    }

    // Performance warnings
    if (attribute.dependencies.length > 10) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: attribute.id,
        message: 'High number of dependencies may impact performance',
        recommendation: 'Consider reducing dependencies or optimizing computation'
      })
    }

    if (attribute.caching.enabled && (!attribute.caching.ttl || attribute.caching.ttl > 3600)) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: attribute.id,
        message: 'Long cache TTL may lead to stale data',
        recommendation: 'Consider shorter TTL for frequently changing data'
      })
    }

    return result
  }

  /**
   * Convert ComputedAttributeDefinition to schema format
   */
  private async convertToSchemaFormat(
    definition: ComputedAttributeDefinition
  ): Promise<ComputedAttributeSchema> {
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      targetType: definition.targetType,
      returnType: this.inferReturnType(definition),
      dependencies: definition.dependencies?.map(dep => ({
        type: dep.type,
        source: dep.source,
        invalidateOnChange: dep.invalidateOnChange,
        priority: 'medium'
      })) || [],
      security: {
        allowedContexts: ['user', 'api'],
        dataClassification: 'internal',
        auditLevel: 'basic'
      },
      caching: {
        enabled: definition.caching.enabled,
        ttl: definition.caching.ttl || 300,
        strategy: 'lru'
      }
    }
  }

  /**
   * Infer return type from definition
   */
  private inferReturnType(definition: ComputedAttributeDefinition): ComputedAttributeSchema['returnType'] {
    // Simple type inference - in real implementation, this would be more sophisticated
    // For now, return 'object' as default
    return 'object'
  }

  /**
   * Check if field name is reserved
   */
  private isReservedFieldName(fieldName: string): boolean {
    const reservedNames = [
      '_id', 'id', '_rev', '_deleted', '_created', '_updated',
      'createdAt', 'updatedAt', 'deletedAt', 'version'
    ]
    return reservedNames.includes(fieldName)
  }

  /**
   * Get current configuration
   */
  getConfig(): SchemaExtensionConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SchemaExtensionConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Generate schema documentation
   */
  async generateDocumentation(schema: CollectionSchemaWithComputedAttributes): Promise<string> {
    const docs: string[] = []

    docs.push(`# Collection Schema: ${schema.name}`)
    docs.push('')

    // Base fields
    docs.push('## Fields')
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      docs.push(`- **${fieldName}** (${fieldDef.type})${fieldDef.required ? ' *required*' : ''}`)
      if (fieldDef.description) {
        docs.push(`  ${fieldDef.description}`)
      }
    }
    docs.push('')

    // Computed attributes
    if (schema.computedAttributes && Object.keys(schema.computedAttributes).length > 0) {
      docs.push('## Computed Attributes')
      for (const [attrId, attr] of Object.entries(schema.computedAttributes)) {
        docs.push(`- **${attr.name}** (${attr.returnType})`)
        if (attr.description) {
          docs.push(`  ${attr.description}`)
        }
        if (attr.dependencies.length > 0) {
          docs.push(`  Dependencies: ${attr.dependencies.map(d => d.source).join(', ')}`)
        }
      }
    }

    return docs.join('\n')
  }
}