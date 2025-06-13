/**
 * Schema integration for computed attributes
 */

export { SchemaExtensions, DEFAULT_SCHEMA_EXTENSION_CONFIG } from './SchemaExtensions'
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
  SchemaValidationWarning
} from './SchemaExtensions'

export { AttributeValidator, DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG } from './AttributeValidator'
export type {
  AttributeValidatorConfig,
  ValidationContext,
  DependencyValidationResult,
  SecurityValidationResult,
  PerformanceValidationResult
} from './AttributeValidator'

export { SchemaIntegration, DEFAULT_SCHEMA_INTEGRATION_CONFIG } from './SchemaIntegration'
export type {
  SchemaIntegrationConfig,
  SchemaVersion,
  SchemaChange,
  CollectionIntegrationResult,
  MigrationPlan,
  MigrationStep
} from './SchemaIntegration'

export { BuiltInAttributes } from './BuiltInAttributes'
