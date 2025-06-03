import type { ComputedAttributeDefinition, AttributeDependency } from '../types'
import type {
  ComputedAttributeSchema,
  ComputedAttributeDependencySchema,
  ValidationRule,
  SchemaValidationResult,
  SchemaValidationError,
  SchemaValidationWarning
} from './SchemaExtensions'
import { ComputedAttributeErrorFactory, ComputedAttributeErrorCodeDetailed } from '../types/ErrorTypes'

/**
 * Validation configuration
 */
export interface AttributeValidatorConfig {
  enableSecurityValidation: boolean
  enablePerformanceValidation: boolean
  enableDependencyValidation: boolean
  enableTypeValidation: boolean
  maxDependencyDepth: number
  maxComputationTimeout: number
  allowedExternalDomains: string[]
  requiredSecurityLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Default validator configuration
 */
export const DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG: AttributeValidatorConfig = {
  enableSecurityValidation: true,
  enablePerformanceValidation: true,
  enableDependencyValidation: true,
  enableTypeValidation: true,
  maxDependencyDepth: 5,
  maxComputationTimeout: 30000, // 30 seconds
  allowedExternalDomains: [],
  requiredSecurityLevel: 'medium'
}

/**
 * Validation context
 */
export interface ValidationContext {
  existingAttributes: ComputedAttributeDefinition[]
  collectionFields: string[]
  availableCollections: string[]
  userRoles: string[]
  systemPermissions: string[]
}

/**
 * Dependency validation result
 */
export interface DependencyValidationResult {
  isValid: boolean
  circularDependencies: string[]
  missingDependencies: string[]
  invalidDependencies: string[]
  maxDepthExceeded: boolean
  warnings: string[]
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  isValid: boolean
  securityViolations: string[]
  missingPermissions: string[]
  unauthorizedExternalAccess: string[]
  dataClassificationIssues: string[]
  warnings: string[]
}

/**
 * Performance validation result
 */
export interface PerformanceValidationResult {
  isValid: boolean
  performanceIssues: string[]
  timeoutRisks: string[]
  memoryRisks: string[]
  cachingRecommendations: string[]
  warnings: string[]
}

/**
 * Comprehensive attribute validator
 */
export class AttributeValidator {
  private config: AttributeValidatorConfig

  constructor(config: Partial<AttributeValidatorConfig> = {}) {
    this.config = { ...DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG, ...config }
  }

  /**
   * Validate computed attribute definition
   */
  async validateAttribute(
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    try {
      // Basic structure validation
      const structureValidation = await this.validateStructure(definition)
      this.mergeValidationResults(result, structureValidation)

      // Type validation
      if (this.config.enableTypeValidation) {
        const typeValidation = await this.validateTypes(definition)
        this.mergeValidationResults(result, typeValidation)
      }

      // Dependency validation
      if (this.config.enableDependencyValidation) {
        const dependencyValidation = await this.validateDependencies(definition, context)
        this.mergeValidationResults(result, dependencyValidation)
      }

      // Security validation
      if (this.config.enableSecurityValidation) {
        const securityValidation = await this.validateSecurity(definition, context)
        this.mergeValidationResults(result, securityValidation)
      }

      // Performance validation
      if (this.config.enablePerformanceValidation) {
        const performanceValidation = await this.validatePerformance(definition)
        this.mergeValidationResults(result, performanceValidation)
      }

      // Business logic validation
      const businessValidation = await this.validateBusinessLogic(definition, context)
      this.mergeValidationResults(result, businessValidation)

      return result

    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })
      return result
    }
  }

  /**
   * Validate attribute structure
   */
  private async validateStructure(definition: ComputedAttributeDefinition): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Required fields
    if (!definition.id || definition.id.trim() === '') {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: 'Attribute ID is required',
        severity: 'error'
      })
      result.isValid = false
    }

    if (!definition.name || definition.name.trim() === '') {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: 'Attribute name is required',
        severity: 'error'
      })
      result.isValid = false
    }

    if (!definition.description || definition.description.trim() === '') {
      result.warnings.push({
        type: 'best_practice',
        attributeId: definition.id,
        message: 'Attribute description is recommended',
        recommendation: 'Add a clear description for better maintainability'
      })
    }

    // ID format validation
    if (definition.id && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(definition.id)) {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: 'Attribute ID must start with a letter and contain only letters, numbers, and underscores',
        severity: 'error'
      })
      result.isValid = false
    }

    // Target type validation
    const validTargetTypes = ['user', 'document', 'collection', 'database']
    if (!validTargetTypes.includes(definition.targetType)) {
      result.errors.push({
        type: 'type_mismatch',
        attributeId: definition.id,
        message: `Invalid target type: ${definition.targetType}`,
        severity: 'error'
      })
      result.isValid = false
    }

    // Document-level attributes must specify target collection
    if (definition.targetType === 'document' && !definition.targetCollection) {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: 'Document-level attributes must specify targetCollection',
        severity: 'error'
      })
      result.isValid = false
    }

    // Compute function validation
    if (!definition.computeFunction) {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: 'Compute function is required',
        severity: 'error'
      })
      result.isValid = false
    }

    return result
  }

  /**
   * Validate attribute types
   */
  private async validateTypes(definition: ComputedAttributeDefinition): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Validate caching configuration
    if (definition.caching) {
      if (typeof definition.caching.enabled !== 'boolean') {
        result.errors.push({
          type: 'type_mismatch',
          attributeId: definition.id,
          message: 'Caching enabled must be a boolean',
          severity: 'error'
        })
        result.isValid = false
      }

      if (definition.caching.ttl !== undefined && (typeof definition.caching.ttl !== 'number' || definition.caching.ttl < 0)) {
        result.errors.push({
          type: 'type_mismatch',
          attributeId: definition.id,
          message: 'Caching TTL must be a non-negative number',
          severity: 'error'
        })
        result.isValid = false
      }
    }

    // Validate security configuration
    if (definition.security) {
      if (typeof definition.security.allowExternalRequests !== 'boolean') {
        result.errors.push({
          type: 'type_mismatch',
          attributeId: definition.id,
          message: 'Security allowExternalRequests must be a boolean',
          severity: 'error'
        })
        result.isValid = false
      }

      if (typeof definition.security.timeout !== 'number' || definition.security.timeout <= 0) {
        result.errors.push({
          type: 'type_mismatch',
          attributeId: definition.id,
          message: 'Security timeout must be a positive number',
          severity: 'error'
        })
        result.isValid = false
      }

      if (typeof definition.security.maxMemoryUsage !== 'number' || definition.security.maxMemoryUsage <= 0) {
        result.errors.push({
          type: 'type_mismatch',
          attributeId: definition.id,
          message: 'Security maxMemoryUsage must be a positive number',
          severity: 'error'
        })
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Validate dependencies
   */
  private async validateDependencies(
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    if (!definition.dependencies || definition.dependencies.length === 0) {
      result.warnings.push({
        type: 'best_practice',
        attributeId: definition.id,
        message: 'Attribute has no dependencies',
        recommendation: 'Consider if this attribute truly needs no dependencies'
      })
      return result
    }

    // Validate each dependency
    for (const dependency of definition.dependencies) {
      const depValidation = await this.validateSingleDependency(dependency, definition, context)
      this.mergeValidationResults(result, depValidation)
    }

    // Check for circular dependencies
    const circularCheck = await this.checkCircularDependencies(definition, context)
    if (!circularCheck.isValid) {
      result.errors.push({
        type: 'invalid_dependency',
        attributeId: definition.id,
        message: `Circular dependency detected: ${circularCheck.circularDependencies.join(' -> ')}`,
        severity: 'error'
      })
      result.isValid = false
    }

    // Check dependency depth
    const depthCheck = await this.checkDependencyDepth(definition, context)
    if (depthCheck.maxDepthExceeded) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: definition.id,
        message: `Dependency depth exceeds recommended maximum (${this.config.maxDependencyDepth})`,
        recommendation: 'Consider reducing dependency chain length for better performance'
      })
    }

    return result
  }

  /**
   * Validate single dependency
   */
  private async validateSingleDependency(
    dependency: AttributeDependency,
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Validate dependency type
    const validTypes = ['field', 'collection', 'external_api', 'system']
    if (!validTypes.includes(dependency.type)) {
      result.errors.push({
        type: 'type_mismatch',
        attributeId: definition.id,
        message: `Invalid dependency type: ${dependency.type}`,
        severity: 'error'
      })
      result.isValid = false
    }

    // Validate dependency source
    if (!dependency.source || dependency.source.trim() === '') {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: 'Dependency source is required',
        severity: 'error'
      })
      result.isValid = false
    }

    // Type-specific validation
    switch (dependency.type) {
      case 'field':
        if (!context.collectionFields.includes(dependency.source)) {
          result.errors.push({
            type: 'invalid_dependency',
            attributeId: definition.id,
            message: `Field dependency '${dependency.source}' does not exist`,
            severity: 'error'
          })
          result.isValid = false
        }
        break

      case 'collection':
        if (!context.availableCollections.includes(dependency.source)) {
          result.errors.push({
            type: 'invalid_dependency',
            attributeId: definition.id,
            message: `Collection dependency '${dependency.source}' does not exist`,
            severity: 'error'
          })
          result.isValid = false
        }
        break

      case 'external_api':
        if (!definition.security.allowExternalRequests) {
          result.errors.push({
            type: 'security_violation',
            attributeId: definition.id,
            message: 'External API dependency requires allowExternalRequests to be true',
            severity: 'error'
          })
          result.isValid = false
        }

        // Validate external domain
        try {
          const url = new URL(dependency.source)
          if (this.config.allowedExternalDomains.length > 0 &&
              !this.config.allowedExternalDomains.includes(url.hostname)) {
            result.errors.push({
              type: 'security_violation',
              attributeId: definition.id,
              message: `External domain '${url.hostname}' is not in allowed domains list`,
              severity: 'error'
            })
            result.isValid = false
          }
        } catch (error) {
          result.errors.push({
            type: 'constraint_violation',
            attributeId: definition.id,
            message: `Invalid external API URL: ${dependency.source}`,
            severity: 'error'
          })
          result.isValid = false
        }
        break

      case 'system':
        // System dependencies are generally allowed but should be documented
        if (!dependency.source.startsWith('system.')) {
          result.warnings.push({
            type: 'best_practice',
            attributeId: definition.id,
            message: 'System dependencies should be prefixed with "system."',
            recommendation: 'Use "system." prefix for clarity'
          })
        }
        break
    }

    return result
  }

  /**
   * Validate security aspects
   */
  private async validateSecurity(
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Check external request permissions
    if (definition.security.allowExternalRequests) {
      if (this.config.requiredSecurityLevel === 'high' || this.config.requiredSecurityLevel === 'critical') {
        result.warnings.push({
          type: 'security_recommendation',
          attributeId: definition.id,
          message: 'External requests require additional security review',
          recommendation: 'Ensure proper authentication and rate limiting for external APIs'
        })
      }

      // Check for HTTPS requirement
      const externalDeps = definition.dependencies.filter(dep => dep.type === 'external_api')
      for (const dep of externalDeps) {
        try {
          const url = new URL(dep.source)
          if (url.protocol !== 'https:') {
            result.warnings.push({
              type: 'security_recommendation',
              attributeId: definition.id,
              message: `External API '${dep.source}' should use HTTPS`,
              recommendation: 'Use HTTPS for all external API calls'
            })
          }
        } catch (error) {
          // URL validation error already handled in dependency validation
        }
      }
    }

    // Check timeout settings
    if (definition.security.timeout > this.config.maxComputationTimeout) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: definition.id,
        message: `Timeout (${definition.security.timeout}ms) exceeds recommended maximum (${this.config.maxComputationTimeout}ms)`,
        recommendation: 'Consider reducing timeout to prevent resource exhaustion'
      })
    }

    // Check memory usage limits
    const maxRecommendedMemory = 100 * 1024 * 1024 // 100MB
    if (definition.security.maxMemoryUsage > maxRecommendedMemory) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: definition.id,
        message: `Memory limit (${Math.round(definition.security.maxMemoryUsage / 1024 / 1024)}MB) is very high`,
        recommendation: 'Consider optimizing computation to use less memory'
      })
    }

    return result
  }

  /**
   * Validate performance aspects
   */
  private async validatePerformance(definition: ComputedAttributeDefinition): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Check caching configuration
    if (!definition.caching.enabled) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: definition.id,
        message: 'Caching is disabled',
        recommendation: 'Consider enabling caching for better performance'
      })
    } else {
      // Check TTL settings
      if (definition.caching.ttl < 60) {
        result.warnings.push({
          type: 'performance_concern',
          attributeId: definition.id,
          message: 'Very short cache TTL may impact performance',
          recommendation: 'Consider longer TTL if data doesn\'t change frequently'
        })
      }

      if (definition.caching.ttl > 86400) { // 24 hours
        result.warnings.push({
          type: 'performance_concern',
          attributeId: definition.id,
          message: 'Very long cache TTL may lead to stale data',
          recommendation: 'Consider shorter TTL or implement proper invalidation'
        })
      }
    }

    // Check dependency count
    if (definition.dependencies.length > 10) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: definition.id,
        message: 'High number of dependencies may impact performance',
        recommendation: 'Consider reducing dependencies or optimizing computation'
      })
    }

    // Check for external API dependencies
    const externalDeps = definition.dependencies.filter(dep => dep.type === 'external_api')
    if (externalDeps.length > 3) {
      result.warnings.push({
        type: 'performance_concern',
        attributeId: definition.id,
        message: 'Multiple external API dependencies may cause slow computation',
        recommendation: 'Consider caching external data or reducing API calls'
      })
    }

    return result
  }

  /**
   * Validate business logic
   */
  private async validateBusinessLogic(
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Check for duplicate attribute IDs
    const existingAttribute = context.existingAttributes.find(attr => attr.id === definition.id)
    if (existingAttribute) {
      result.errors.push({
        type: 'constraint_violation',
        attributeId: definition.id,
        message: `Attribute with ID '${definition.id}' already exists`,
        severity: 'error'
      })
      result.isValid = false
    }

    // Check for similar attribute names
    const similarAttribute = context.existingAttributes.find(attr =>
      attr.name.toLowerCase() === definition.name.toLowerCase() && attr.id !== definition.id
    )
    if (similarAttribute) {
      result.warnings.push({
        type: 'best_practice',
        attributeId: definition.id,
        message: `Similar attribute name exists: '${similarAttribute.name}' (ID: ${similarAttribute.id})`,
        recommendation: 'Consider using a more distinctive name'
      })
    }

    // Validate target collection exists for document-level attributes
    if (definition.targetType === 'document' && definition.targetCollection) {
      if (!context.availableCollections.includes(definition.targetCollection)) {
        result.errors.push({
          type: 'constraint_violation',
          attributeId: definition.id,
          message: `Target collection '${definition.targetCollection}' does not exist`,
          severity: 'error'
        })
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Check for circular dependencies
   */
  private async checkCircularDependencies(
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<DependencyValidationResult> {
    const result: DependencyValidationResult = {
      isValid: true,
      circularDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
      maxDepthExceeded: false,
      warnings: []
    }

    // Build dependency graph
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const checkCircular = (attributeId: string, path: string[]): boolean => {
      if (recursionStack.has(attributeId)) {
        result.circularDependencies = [...path, attributeId]
        return false
      }

      if (visited.has(attributeId)) {
        return true
      }

      visited.add(attributeId)
      recursionStack.add(attributeId)

      // Find attribute definition
      const attr = attributeId === definition.id ? definition :
                   context.existingAttributes.find(a => a.id === attributeId)

             if (attr) {
         for (const dep of attr.dependencies) {
           // Check if dependency refers to another computed attribute
           if (context.existingAttributes.some(a => a.id === dep.source)) {
             if (!checkCircular(dep.source, [...path, attributeId])) {
               result.isValid = false
               return false
             }
           }
         }
       }

      recursionStack.delete(attributeId)
      return true
    }

    checkCircular(definition.id, [])

    return result
  }

  /**
   * Check dependency depth
   */
  private async checkDependencyDepth(
    definition: ComputedAttributeDefinition,
    context: ValidationContext
  ): Promise<DependencyValidationResult> {
    const result: DependencyValidationResult = {
      isValid: true,
      circularDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
      maxDepthExceeded: false,
      warnings: []
    }

    const calculateDepth = (attributeId: string, visited: Set<string>): number => {
      if (visited.has(attributeId)) {
        return 0 // Avoid infinite recursion
      }

      visited.add(attributeId)

      const attr = attributeId === definition.id ? definition :
                   context.existingAttributes.find(a => a.id === attributeId)

      if (!attr) {
        return 0
      }

             let maxDepth = 0
       for (const dep of attr.dependencies) {
         // Check if dependency refers to another computed attribute
         if (context.existingAttributes.some(a => a.id === dep.source)) {
           const depDepth = calculateDepth(dep.source, new Set(visited))
           maxDepth = Math.max(maxDepth, depDepth + 1)
         }
       }

      return maxDepth
    }

    const depth = calculateDepth(definition.id, new Set())
    if (depth > this.config.maxDependencyDepth) {
      result.maxDepthExceeded = true
    }

    return result
  }

  /**
   * Merge validation results
   */
  private mergeValidationResults(target: SchemaValidationResult, source: SchemaValidationResult): void {
    if (!source.isValid) {
      target.isValid = false
    }
    target.errors.push(...source.errors)
    target.warnings.push(...source.warnings)
    target.suggestions.push(...source.suggestions)
  }

  /**
   * Get current configuration
   */
  getConfig(): AttributeValidatorConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AttributeValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}