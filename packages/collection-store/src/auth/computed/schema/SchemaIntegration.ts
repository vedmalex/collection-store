import type { ComputedAttributeDefinition } from '../types'
import type { CSDatabase } from '../../..'
import type {
  CollectionSchemaWithComputedAttributes,
  BaseCollectionSchema,
  SchemaExtensionResult,
  SchemaValidationResult
} from './SchemaExtensions'
import { SchemaExtensions } from './SchemaExtensions'
import { AttributeValidator, type ValidationContext } from './AttributeValidator'
import { ComputedAttributeErrorFactory, ComputedAttributeErrorCodeDetailed } from '../types/ErrorTypes'

/**
 * Schema integration configuration
 */
export interface SchemaIntegrationConfig {
  enableAutoValidation: boolean
  enableSchemaVersioning: boolean
  enableMigrationSupport: boolean
  enableBackwardCompatibility: boolean
  maxSchemaVersions: number
  validationTimeout: number
  enableSchemaCache: boolean
  schemaCacheTTL: number
}

/**
 * Default schema integration configuration
 */
export const DEFAULT_SCHEMA_INTEGRATION_CONFIG: SchemaIntegrationConfig = {
  enableAutoValidation: true,
  enableSchemaVersioning: true,
  enableMigrationSupport: true,
  enableBackwardCompatibility: true,
  maxSchemaVersions: 10,
  validationTimeout: 5000, // 5 seconds
  enableSchemaCache: true,
  schemaCacheTTL: 300 // 5 minutes
}

/**
 * Schema version information
 */
export interface SchemaVersion {
  version: number
  timestamp: Date
  changes: SchemaChange[]
  computedAttributes: Record<string, ComputedAttributeDefinition>
  createdBy: string
  description?: string
}

/**
 * Schema change record
 */
export interface SchemaChange {
  type: 'add_attribute' | 'remove_attribute' | 'modify_attribute' | 'add_field' | 'remove_field' | 'modify_field'
  target: string // attribute ID or field name
  before?: any
  after?: any
  reason?: string
  timestamp: Date
}

/**
 * Collection integration result
 */
export interface CollectionIntegrationResult {
  success: boolean
  collectionName: string
  schemaVersion: number
  addedAttributes: string[]
  modifiedFields: string[]
  errors: string[]
  warnings: string[]
  migrationRequired: boolean
  backwardCompatible: boolean
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  fromVersion: number
  toVersion: number
  steps: MigrationStep[]
  estimatedTime: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  backupRequired: boolean
  rollbackPlan: MigrationStep[]
}

/**
 * Migration step
 */
export interface MigrationStep {
  type: 'add_computed_attribute' | 'remove_computed_attribute' | 'modify_computed_attribute' | 'recompute_values' | 'update_indexes'
  description: string
  attributeId?: string
  estimatedTime: number
  reversible: boolean
  dependencies: string[]
}

/**
 * Schema integration with TypedCollection
 */
export class SchemaIntegration {
  private config: SchemaIntegrationConfig
  private schemaExtensions: SchemaExtensions
  private attributeValidator: AttributeValidator
  private database?: CSDatabase
  private schemaCache = new Map<string, CollectionSchemaWithComputedAttributes>()
  private schemaVersions = new Map<string, SchemaVersion[]>()

  constructor(
    config: Partial<SchemaIntegrationConfig> = {},
    schemaExtensions?: SchemaExtensions,
    attributeValidator?: AttributeValidator
  ) {
    this.config = { ...DEFAULT_SCHEMA_INTEGRATION_CONFIG, ...config }
    this.schemaExtensions = schemaExtensions || new SchemaExtensions()
    this.attributeValidator = attributeValidator || new AttributeValidator()
  }

  /**
   * Set database instance
   */
  setDatabase(database: CSDatabase): void {
    this.database = database
  }

  /**
   * Integrate computed attributes with collection schema
   */
  async integrateWithCollection(
    collectionName: string,
    baseSchema: BaseCollectionSchema,
    computedAttributes: ComputedAttributeDefinition[]
  ): Promise<CollectionIntegrationResult> {
    const result: CollectionIntegrationResult = {
      success: false,
      collectionName,
      schemaVersion: 1,
      addedAttributes: [],
      modifiedFields: [],
      errors: [],
      warnings: [],
      migrationRequired: false,
      backwardCompatible: true
    }

    try {
      // Validate computed attributes
      if (this.config.enableAutoValidation) {
        const validationResult = await this.validateComputedAttributes(
          computedAttributes,
          baseSchema,
          collectionName
        )

        if (!validationResult.isValid) {
          result.errors.push(...validationResult.errors.map(e => e.message))
          return result
        }

        result.warnings.push(...validationResult.warnings.map(w => w.message))
      }

      // Extend schema with computed attributes
      const extensionResult = await this.schemaExtensions.extendSchema(baseSchema, computedAttributes)
      if (!extensionResult.success) {
        result.errors.push(...extensionResult.errors)
        return result
      }

      const extendedSchema = extensionResult.extendedSchema!
      result.addedAttributes = extensionResult.addedAttributes
      result.modifiedFields = extensionResult.modifiedFields
      result.warnings.push(...extensionResult.warnings)

      // Check for schema versioning
      if (this.config.enableSchemaVersioning) {
        const versionResult = await this.handleSchemaVersioning(
          collectionName,
          extendedSchema,
          computedAttributes
        )
        result.schemaVersion = versionResult.version
        result.migrationRequired = versionResult.migrationRequired
        result.backwardCompatible = versionResult.backwardCompatible
      }

      // Cache the schema
      if (this.config.enableSchemaCache) {
        this.cacheSchema(collectionName, extendedSchema)
      }

      // Apply schema to collection (if database is available)
      if (this.database) {
        await this.applySchemaToCollection(collectionName, extendedSchema)
      }

      result.success = true
      return result

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during integration')
      return result
    }
  }

  /**
   * Get extended schema for collection
   */
  async getExtendedSchema(collectionName: string): Promise<CollectionSchemaWithComputedAttributes | undefined> {
    // Check cache first
    if (this.config.enableSchemaCache && this.schemaCache.has(collectionName)) {
      return this.schemaCache.get(collectionName)
    }

    // Load from database if available
    if (this.database) {
      return await this.loadSchemaFromDatabase(collectionName)
    }

    return undefined
  }

  /**
   * Update computed attributes in existing schema
   */
  async updateComputedAttributes(
    collectionName: string,
    attributeUpdates: {
      add?: ComputedAttributeDefinition[]
      remove?: string[]
      modify?: { id: string; definition: ComputedAttributeDefinition }[]
    }
  ): Promise<CollectionIntegrationResult> {
    const result: CollectionIntegrationResult = {
      success: false,
      collectionName,
      schemaVersion: 1,
      addedAttributes: [],
      modifiedFields: [],
      errors: [],
      warnings: [],
      migrationRequired: false,
      backwardCompatible: true
    }

    try {
      // Get current schema
      const currentSchema = await this.getExtendedSchema(collectionName)
      if (!currentSchema) {
        result.errors.push(`Schema not found for collection: ${collectionName}`)
        return result
      }

      // Create updated schema
      const updatedSchema = { ...currentSchema }
      const computedAttributes = { ...(updatedSchema.computedAttributes || {}) }

      // Process additions
      if (attributeUpdates.add) {
        for (const attr of attributeUpdates.add) {
          if (computedAttributes && computedAttributes[attr.id]) {
            result.errors.push(`Computed attribute '${attr.id}' already exists`)
            continue
          }

          // Validate new attribute
          const validationContext = await this.createValidationContext(collectionName, currentSchema)
          const validation = await this.attributeValidator.validateAttribute(attr, validationContext)

          if (!validation.isValid) {
            result.errors.push(...validation.errors.map(e => e.message))
            continue
          }

          // Convert to schema format
          const schemaAttr = await this.convertToSchemaAttribute(attr)
          computedAttributes[attr.id] = schemaAttr
          result.addedAttributes.push(attr.id)
        }
      }

      // Process removals
      if (attributeUpdates.remove) {
        for (const attrId of attributeUpdates.remove) {
          if (!computedAttributes || !computedAttributes[attrId]) {
            result.warnings.push(`Computed attribute '${attrId}' not found for removal`)
            continue
          }

          delete computedAttributes[attrId]
          result.migrationRequired = true
        }
      }

      // Process modifications
      if (attributeUpdates.modify) {
        for (const { id, definition } of attributeUpdates.modify) {
          if (!computedAttributes || !computedAttributes[id]) {
            result.errors.push(`Computed attribute '${id}' not found for modification`)
            continue
          }

          // Validate modified attribute (exclude the current attribute from existing attributes check)
          const validationContext = await this.createValidationContext(collectionName, currentSchema)
          // Remove the current attribute from existing attributes to avoid duplicate detection
          validationContext.existingAttributes = validationContext.existingAttributes.filter(attr => attr.id !== id)
          const validation = await this.attributeValidator.validateAttribute(definition, validationContext)

          if (!validation.isValid) {
            result.errors.push(...validation.errors.map(e => e.message))
            continue
          }

          const schemaAttr = await this.convertToSchemaAttribute(definition)
          computedAttributes[id] = schemaAttr
          result.migrationRequired = true
        }
      }

      if (result.errors.length > 0) {
        return result
      }

      // Update schema
      updatedSchema.computedAttributes = computedAttributes

      // Handle versioning
      if (this.config.enableSchemaVersioning) {
        const versionResult = await this.createNewSchemaVersion(
          collectionName,
          updatedSchema,
          attributeUpdates
        )
        result.schemaVersion = versionResult.version
      }

      // Update cache
      if (this.config.enableSchemaCache) {
        this.cacheSchema(collectionName, updatedSchema)
      }

      // Apply to database
      if (this.database) {
        await this.applySchemaToCollection(collectionName, updatedSchema)
      }

      result.success = true
      return result

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during update')
      return result
    }
  }

  /**
   * Generate migration plan
   */
  async generateMigrationPlan(
    collectionName: string,
    fromVersion: number,
    toVersion: number
  ): Promise<MigrationPlan> {
    const plan: MigrationPlan = {
      fromVersion,
      toVersion,
      steps: [],
      estimatedTime: 0,
      riskLevel: 'low',
      backupRequired: false,
      rollbackPlan: []
    }

    try {
      const versions = this.schemaVersions.get(collectionName) || []
      const fromVersionData = versions.find(v => v.version === fromVersion)
      const toVersionData = versions.find(v => v.version === toVersion)

      if (!fromVersionData || !toVersionData) {
        throw new Error(`Version data not found for migration from ${fromVersion} to ${toVersion}`)
      }

      // Analyze changes between versions
      const changes = this.analyzeSchemaChanges(fromVersionData, toVersionData)

      // Generate migration steps
      for (const change of changes) {
        const step = await this.createMigrationStep(change)
        plan.steps.push(step)
        plan.estimatedTime += step.estimatedTime

        // Assess risk level
        if (change.type === 'remove_attribute' || change.type === 'modify_attribute') {
          plan.riskLevel = 'medium'
          plan.backupRequired = true
        }
      }

      // Generate rollback plan
      plan.rollbackPlan = await this.generateRollbackSteps(plan.steps)

      return plan

    } catch (error) {
      throw ComputedAttributeErrorFactory.create(
        `Failed to generate migration plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR,
        'schema_integration'
      )
    }
  }

  /**
   * Execute migration plan
   */
  async executeMigration(collectionName: string, plan: MigrationPlan): Promise<boolean> {
    if (!this.database) {
      throw ComputedAttributeErrorFactory.create(
        'Database not available for migration execution',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR,
        'schema_integration'
      )
    }

    try {
      // Create backup if required
      if (plan.backupRequired) {
        await this.createSchemaBackup(collectionName)
      }

      // Execute migration steps
      for (const step of plan.steps) {
        await this.executeMigrationStep(collectionName, step)
      }

      return true

    } catch (error) {
      // Attempt rollback
      try {
        await this.executeRollback(collectionName, plan.rollbackPlan)
      } catch (rollbackError) {
        throw ComputedAttributeErrorFactory.create(
          `Migration failed and rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED,
          'schema_integration'
        )
      }

      throw ComputedAttributeErrorFactory.create(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED,
        'schema_integration'
      )
    }
  }

  /**
   * Validate computed attributes against schema
   */
  private async validateComputedAttributes(
    attributes: ComputedAttributeDefinition[],
    baseSchema: BaseCollectionSchema,
    collectionName: string
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    const validationContext = await this.createValidationContext(collectionName, baseSchema)

    for (const attr of attributes) {
      const validation = await this.attributeValidator.validateAttribute(attr, validationContext)

      if (!validation.isValid) {
        result.isValid = false
      }

      result.errors.push(...validation.errors)
      result.warnings.push(...validation.warnings)
      result.suggestions.push(...validation.suggestions)
    }

    return result
  }

  /**
   * Create validation context
   */
  private async createValidationContext(
    collectionName: string,
    schema: BaseCollectionSchema | CollectionSchemaWithComputedAttributes
  ): Promise<ValidationContext> {
    const context: ValidationContext = {
      existingAttributes: [],
      collectionFields: Object.keys(schema.fields),
      availableCollections: [],
      userRoles: [],
      systemPermissions: []
    }

    // Get existing computed attributes
    if ('computedAttributes' in schema && schema.computedAttributes) {
      // Convert schema attributes back to definitions for validation
      // This is a simplified conversion - in real implementation, store original definitions
      context.existingAttributes = Object.values(schema.computedAttributes).map(attr => ({
        id: attr.id,
        name: attr.name,
        description: attr.description || '',
        targetType: attr.targetType,
        computeFunction: async () => ({}), // Placeholder
                 dependencies: attr.dependencies.map(dep => ({
           type: dep.type as 'field' | 'collection' | 'external_api' | 'system',
           source: dep.source,
           invalidateOnChange: dep.invalidateOnChange
         })),
                 caching: {
           enabled: attr.caching.enabled,
           ttl: attr.caching.ttl || 300,
           invalidateOn: []
         },
        security: {
          allowExternalRequests: false,
          timeout: 5000,
          maxMemoryUsage: 50 * 1024 * 1024
        },
        createdBy: 'system',
        createdAt: new Date(),
        isActive: true
      }))
    }

    // Get available collections from database
    if (this.database) {
      try {
        context.availableCollections = await this.getAvailableCollections()
      } catch (error) {
        // Continue with empty collections list
      }
    }

    return context
  }

  /**
   * Handle schema versioning
   */
  private async handleSchemaVersioning(
    collectionName: string,
    schema: CollectionSchemaWithComputedAttributes,
    attributes: ComputedAttributeDefinition[]
  ): Promise<{ version: number; migrationRequired: boolean; backwardCompatible: boolean }> {
    const versions = this.schemaVersions.get(collectionName) || []
    const currentVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0
    const newVersion = currentVersion + 1

    // Create new version record
    const versionRecord: SchemaVersion = {
      version: newVersion,
      timestamp: new Date(),
      changes: [],
      computedAttributes: attributes.reduce((acc, attr) => {
        acc[attr.id] = attr
        return acc
      }, {} as Record<string, ComputedAttributeDefinition>),
      createdBy: 'system', // In real implementation, get from context
      description: `Added ${attributes.length} computed attributes`
    }

    // Store version
    if (!this.schemaVersions.has(collectionName)) {
      this.schemaVersions.set(collectionName, [])
    }
    this.schemaVersions.get(collectionName)!.push(versionRecord)

    // Cleanup old versions
    const allVersions = this.schemaVersions.get(collectionName)!
    if (allVersions.length > this.config.maxSchemaVersions) {
      allVersions.splice(0, allVersions.length - this.config.maxSchemaVersions)
    }

    return {
      version: newVersion,
      migrationRequired: currentVersion > 0,
      backwardCompatible: true // Simplified - in real implementation, analyze compatibility
    }
  }

  /**
   * Cache schema
   */
  private cacheSchema(collectionName: string, schema: CollectionSchemaWithComputedAttributes): void {
    this.schemaCache.set(collectionName, schema)

    // Set TTL cleanup only if TTL is reasonable (not in test environment)
    if (this.config.schemaCacheTTL > 0 && this.config.schemaCacheTTL < 86400) { // Less than 24 hours
      setTimeout(() => {
        this.schemaCache.delete(collectionName)
      }, this.config.schemaCacheTTL * 1000)
    }
  }

  /**
   * Convert ComputedAttributeDefinition to schema format
   */
  private async convertToSchemaAttribute(definition: ComputedAttributeDefinition): Promise<any> {
    // For now, just return the definition as-is since it's already in the correct format
    // In a real implementation, this might involve more complex transformation
    return definition
  }

  /**
   * Apply schema to collection (placeholder)
   */
  private async applySchemaToCollection(
    collectionName: string,
    schema: CollectionSchemaWithComputedAttributes
  ): Promise<void> {
    // In real implementation, this would update the collection schema in the database
    // For now, this is a placeholder
  }

  /**
   * Load schema from database (placeholder)
   */
  private async loadSchemaFromDatabase(collectionName: string): Promise<CollectionSchemaWithComputedAttributes | undefined> {
    // In real implementation, this would load the schema from the database
    // For now, return undefined
    return undefined
  }

  /**
   * Get available collections (placeholder)
   */
  private async getAvailableCollections(): Promise<string[]> {
    // In real implementation, this would query the database for available collections
    return []
  }

  /**
   * Analyze schema changes between versions
   */
  private analyzeSchemaChanges(fromVersion: SchemaVersion, toVersion: SchemaVersion): SchemaChange[] {
    const changes: SchemaChange[] = []

    // Compare computed attributes
    const fromAttrs = fromVersion.computedAttributes
    const toAttrs = toVersion.computedAttributes

    // Find added attributes
    for (const [id, attr] of Object.entries(toAttrs)) {
      if (!fromAttrs[id]) {
        changes.push({
          type: 'add_attribute',
          target: id,
          after: attr,
          timestamp: new Date()
        })
      }
    }

    // Find removed attributes
    for (const [id, attr] of Object.entries(fromAttrs)) {
      if (!toAttrs[id]) {
        changes.push({
          type: 'remove_attribute',
          target: id,
          before: attr,
          timestamp: new Date()
        })
      }
    }

    // Find modified attributes
    for (const [id, attr] of Object.entries(toAttrs)) {
      if (fromAttrs[id] && JSON.stringify(fromAttrs[id]) !== JSON.stringify(attr)) {
        changes.push({
          type: 'modify_attribute',
          target: id,
          before: fromAttrs[id],
          after: attr,
          timestamp: new Date()
        })
      }
    }

    return changes
  }

  /**
   * Create migration step from schema change
   */
  private async createMigrationStep(change: SchemaChange): Promise<MigrationStep> {
    const step: MigrationStep = {
      type: change.type === 'add_attribute' ? 'add_computed_attribute' :
            change.type === 'remove_attribute' ? 'remove_computed_attribute' :
            'modify_computed_attribute',
      description: `${change.type} ${change.target}`,
      attributeId: change.target,
      estimatedTime: 1000, // 1 second default
      reversible: change.type !== 'remove_attribute',
      dependencies: []
    }

    return step
  }

  /**
   * Generate rollback steps
   */
  private async generateRollbackSteps(steps: MigrationStep[]): Promise<MigrationStep[]> {
    return steps.reverse().filter(step => step.reversible).map(step => ({
      ...step,
      type: step.type === 'add_computed_attribute' ? 'remove_computed_attribute' :
            step.type === 'remove_computed_attribute' ? 'add_computed_attribute' :
            step.type,
      description: `Rollback: ${step.description}`
    }))
  }

  /**
   * Create new schema version
   */
  private async createNewSchemaVersion(
    collectionName: string,
    schema: CollectionSchemaWithComputedAttributes,
    updates: any
  ): Promise<{ version: number }> {
    const versions = this.schemaVersions.get(collectionName) || []
    const newVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1

    // Create version record (simplified)
    const versionRecord: SchemaVersion = {
      version: newVersion,
      timestamp: new Date(),
      changes: [],
      computedAttributes: {},
      createdBy: 'system'
    }

    if (!this.schemaVersions.has(collectionName)) {
      this.schemaVersions.set(collectionName, [])
    }
    this.schemaVersions.get(collectionName)!.push(versionRecord)

    return { version: newVersion }
  }

  /**
   * Create schema backup (placeholder)
   */
  private async createSchemaBackup(collectionName: string): Promise<void> {
    // In real implementation, create backup of current schema
  }

  /**
   * Execute migration step (placeholder)
   */
  private async executeMigrationStep(collectionName: string, step: MigrationStep): Promise<void> {
    // In real implementation, execute the migration step
  }

  /**
   * Execute rollback (placeholder)
   */
  private async executeRollback(collectionName: string, steps: MigrationStep[]): Promise<void> {
    // In real implementation, execute rollback steps
  }

  /**
   * Get current configuration
   */
  getConfig(): SchemaIntegrationConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SchemaIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear()
  }

  /**
   * Get schema versions for collection
   */
  getSchemaVersions(collectionName: string): SchemaVersion[] {
    return this.schemaVersions.get(collectionName) || []
  }
}