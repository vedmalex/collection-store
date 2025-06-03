/**
 * Core computed attributes implementation
 */

export { ComputedAttributeEngine } from './ComputedAttributeEngine'
export type { ComputedAttributeEngineConfig } from './ComputedAttributeEngine'

export { DependencyTracker } from './DependencyTracker'
export type { DependencyTrackerConfig } from './DependencyTracker'

export { MemoryLimitManager } from './MemoryLimitManager'
export type { MemoryLimitConfig, MemoryUsageStats, LimitedExecutionContext } from './MemoryLimitManager'

export { ComputationContextBuilder, SimpleHttpClient } from './ComputationContextBuilder'
export type { ContextBuilderConfig, ContextBuildOptions } from './ComputationContextBuilder'

// Cache exports
export {
  ComputedAttributeCache,
  CacheInvalidator,
  DEFAULT_CACHE_INVALIDATOR_CONFIG
} from '../cache'
export type {
  CacheInvalidatorConfig,
  InvalidationRequest,
  InvalidationResult,
  BatchInvalidationResult,
  DatabaseChangeEvent,
  InvalidationMetrics
} from '../cache'

// Schema exports
export {
  SchemaExtensions,
  DEFAULT_SCHEMA_EXTENSION_CONFIG,
  AttributeValidator,
  DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG,
  SchemaIntegration,
  DEFAULT_SCHEMA_INTEGRATION_CONFIG,
  BuiltInAttributes
} from '../schema'
export type {
  BaseCollectionSchema,
  FieldDefinition,
  IndexDefinition,
  ConstraintDefinition,
  ValidationRule,
  ComputedAttributeSchema,
  ComputedAttributeDependencySchema,
  ComputedAttributeSecuritySchema,
  ComputedAttributeCachingSchema,
  CollectionSchemaWithComputedAttributes,
  SchemaExtensionConfig,
  SchemaExtensionResult,
  SchemaValidationResult,
  SchemaValidationError,
  SchemaValidationWarning,
  AttributeValidatorConfig,
  ValidationContext,
  DependencyValidationResult,
  SecurityValidationResult,
  PerformanceValidationResult,
  SchemaIntegrationConfig,
  SchemaVersion,
  SchemaChange,
  CollectionIntegrationResult,
  MigrationPlan,
  MigrationStep
} from '../schema'
