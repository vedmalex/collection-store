import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  SchemaExtensions,
  DEFAULT_SCHEMA_EXTENSION_CONFIG,
  AttributeValidator,
  DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG,
  SchemaIntegration,
  DEFAULT_SCHEMA_INTEGRATION_CONFIG,
  BuiltInAttributes,
  type BaseCollectionSchema,
  type CollectionSchemaWithComputedAttributes,
  type ValidationContext
} from '../schema'
import type { ComputedAttributeDefinition } from '../types'

// Helper function to create test schema
function createTestSchema(): BaseCollectionSchema {
  return {
    name: 'users',
    fields: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      age: { type: 'number', required: false },
      roles: { type: 'array', required: false },
      createdAt: { type: 'date', required: true },
      updatedAt: { type: 'date', required: false }
    },
    indexes: [
      { name: 'email_idx', fields: ['email'], unique: true },
      { name: 'name_idx', fields: ['name'] }
    ]
  }
}

// Helper function to create test computed attribute
function createTestComputedAttribute(): ComputedAttributeDefinition {
  return {
    id: 'user_score',
    name: 'User Score',
    description: 'Calculated user score based on activity',
    targetType: 'user',
    computeFunction: async (context) => {
      const user = context.target
      return user ? (user.age || 0) * 10 : 0
    },
    dependencies: [
      { type: 'field', source: 'age', invalidateOnChange: true }
    ],
    caching: {
      enabled: true,
      ttl: 300,
      invalidateOn: [
        { type: 'field_change', source: 'age' }
      ]
    },
    security: {
      allowExternalRequests: false,
      timeout: 1000,
      maxMemoryUsage: 1024 * 1024
    },
    createdBy: 'test',
    createdAt: new Date(),
    isActive: true
  }
}

// Helper function to create validation context
function createValidationContext(): ValidationContext {
  return {
    existingAttributes: [],
    collectionFields: ['id', 'name', 'email', 'age', 'roles', 'createdAt', 'updatedAt'],
    availableCollections: ['users', 'posts', 'comments'],
    userRoles: ['admin', 'user', 'moderator'],
    systemPermissions: ['read', 'write', 'delete', 'admin']
  }
}

describe('Day 8 Schema Integration Implementation', () => {
  describe('SchemaExtensions', () => {
    let schemaExtensions: SchemaExtensions

    beforeEach(() => {
      schemaExtensions = new SchemaExtensions()
    })

    describe('Configuration', () => {
      test('should initialize with default configuration', () => {
        const config = schemaExtensions.getConfig()
        expect(config.enableComputedAttributes).toBe(DEFAULT_SCHEMA_EXTENSION_CONFIG.enableComputedAttributes)
        expect(config.enableValidation).toBe(DEFAULT_SCHEMA_EXTENSION_CONFIG.enableValidation)
        expect(config.maxAttributesPerCollection).toBe(DEFAULT_SCHEMA_EXTENSION_CONFIG.maxAttributesPerCollection)
      })

      test('should update configuration', () => {
        schemaExtensions.updateConfig({ maxAttributesPerCollection: 25 })
        const config = schemaExtensions.getConfig()
        expect(config.maxAttributesPerCollection).toBe(25)
      })

      test('should use custom configuration', () => {
        const customExtensions = new SchemaExtensions({
          enableComputedAttributes: false,
          maxAttributesPerCollection: 10
        })
        const config = customExtensions.getConfig()
        expect(config.enableComputedAttributes).toBe(false)
        expect(config.maxAttributesPerCollection).toBe(10)
      })
    })

    describe('Schema Extension', () => {
      test('should extend schema with computed attributes', async () => {
        const baseSchema = createTestSchema()
        const computedAttribute = createTestComputedAttribute()

        const result = await schemaExtensions.extendSchema(baseSchema, [computedAttribute])

        expect(result.success).toBe(true)
        expect(result.extendedSchema).toBeDefined()
        expect(result.addedAttributes).toContain('user_score')
        expect(result.errors).toHaveLength(0)

        const extendedSchema = result.extendedSchema!
        expect(extendedSchema.computedAttributes).toBeDefined()
        expect(extendedSchema.computedAttributes!['user_score']).toBeDefined()
        expect(extendedSchema.computedAttributeConfig).toBeDefined()
      })

      test('should validate base schema', async () => {
        const invalidSchema: BaseCollectionSchema = {
          name: '',
          fields: {}
        }
        const computedAttribute = createTestComputedAttribute()

        const result = await schemaExtensions.extendSchema(invalidSchema, [computedAttribute])

        expect(result.success).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(e => e.includes('Collection name is required'))).toBe(true)
      })

      test('should enforce attribute limit', async () => {
        const baseSchema = createTestSchema()
        const attributes = Array.from({ length: 60 }, (_, i) => ({
          ...createTestComputedAttribute(),
          id: `attr_${i}`,
          name: `Attribute ${i}`
        }))

        const result = await schemaExtensions.extendSchema(baseSchema, attributes)

        expect(result.success).toBe(false)
        expect(result.errors.some(e => e.includes('Too many computed attributes'))).toBe(true)
      })

      test('should generate schema documentation', async () => {
        const baseSchema = createTestSchema()
        const computedAttribute = createTestComputedAttribute()

        const result = await schemaExtensions.extendSchema(baseSchema, [computedAttribute])
        expect(result.success).toBe(true)

        const documentation = await schemaExtensions.generateDocumentation(result.extendedSchema!)

        expect(documentation).toContain('# Collection Schema: users')
        expect(documentation).toContain('## Fields')
        expect(documentation).toContain('## Computed Attributes')
        expect(documentation).toContain('User Score')
      })
    })

    describe('Schema Validation', () => {
      test('should validate field definitions', async () => {
        const schemaWithInvalidField: BaseCollectionSchema = {
          name: 'test',
          fields: {
            invalidField: { type: 'string' as any, required: true }
          }
        }

        const validation = await schemaExtensions.validateBaseSchema(schemaWithInvalidField)
        expect(validation.isValid).toBe(true) // Basic validation should pass
      })

      test('should detect reserved field names', async () => {
        const schemaWithReservedField: BaseCollectionSchema = {
          name: 'test',
          fields: {
            _id: { type: 'string', required: true },
            name: { type: 'string', required: true }
          }
        }

        const validation = await schemaExtensions.validateBaseSchema(schemaWithReservedField)
        expect(validation.warnings.some(w => w.message.includes('reserved'))).toBe(true)
      })

      test('should validate indexes', async () => {
        const schemaWithInvalidIndex: BaseCollectionSchema = {
          name: 'test',
          fields: {
            name: { type: 'string', required: true }
          },
          indexes: [
            { name: 'invalid_idx', fields: ['nonexistent_field'] }
          ]
        }

        const validation = await schemaExtensions.validateBaseSchema(schemaWithInvalidIndex)
        expect(validation.isValid).toBe(false)
        expect(validation.errors.some(e => e.message.includes('non-existent field'))).toBe(true)
      })
    })
  })

  describe('AttributeValidator', () => {
    let validator: AttributeValidator
    let validationContext: ValidationContext

    beforeEach(() => {
      validator = new AttributeValidator()
      validationContext = createValidationContext()
    })

    describe('Configuration', () => {
      test('should initialize with default configuration', () => {
        const config = validator.getConfig()
        expect(config.enableSecurityValidation).toBe(DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG.enableSecurityValidation)
        expect(config.maxDependencyDepth).toBe(DEFAULT_ATTRIBUTE_VALIDATOR_CONFIG.maxDependencyDepth)
      })

      test('should update configuration', () => {
        validator.updateConfig({ maxDependencyDepth: 10 })
        const config = validator.getConfig()
        expect(config.maxDependencyDepth).toBe(10)
      })
    })

    describe('Attribute Validation', () => {
      test('should validate valid attribute', async () => {
        const attribute = createTestComputedAttribute()

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      test('should detect missing required fields', async () => {
        const invalidAttribute = {
          ...createTestComputedAttribute(),
          id: '',
          name: ''
        }

        const result = await validator.validateAttribute(invalidAttribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('Attribute ID is required'))).toBe(true)
        expect(result.errors.some(e => e.message.includes('Attribute name is required'))).toBe(true)
      })

      test('should validate ID format', async () => {
        const invalidAttribute = {
          ...createTestComputedAttribute(),
          id: '123invalid-id'
        }

        const result = await validator.validateAttribute(invalidAttribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('must start with a letter'))).toBe(true)
      })

      test('should validate target type', async () => {
        const invalidAttribute = {
          ...createTestComputedAttribute(),
          targetType: 'invalid' as any
        }

        const result = await validator.validateAttribute(invalidAttribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('Invalid target type'))).toBe(true)
      })

      test('should validate document-level attributes require target collection', async () => {
        const documentAttribute = {
          ...createTestComputedAttribute(),
          targetType: 'document' as const,
          targetCollection: undefined
        }

        const result = await validator.validateAttribute(documentAttribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('must specify targetCollection'))).toBe(true)
      })
    })

    describe('Dependency Validation', () => {
      test('should validate field dependencies', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          dependencies: [
            { type: 'field' as const, source: 'nonexistent_field', invalidateOnChange: true }
          ]
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true)
      })

      test('should validate collection dependencies', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          dependencies: [
            { type: 'collection' as const, source: 'nonexistent_collection', invalidateOnChange: true }
          ]
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true)
      })

      test('should validate external API dependencies', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          dependencies: [
            { type: 'external_api' as const, source: 'https://api.example.com', invalidateOnChange: true }
          ],
          security: {
            ...createTestComputedAttribute().security,
            allowExternalRequests: false
          }
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('requires allowExternalRequests'))).toBe(true)
      })

      test('should warn about high dependency count', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          dependencies: Array.from({ length: 15 }, (_, i) => ({
            type: 'field' as const,
            source: i < validationContext.collectionFields.length ? validationContext.collectionFields[i % validationContext.collectionFields.length] : 'name',
            invalidateOnChange: true
          }))
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('High number of dependencies'))).toBe(true)
      })
    })

    describe('Security Validation', () => {
      test('should validate external request security', async () => {
        const customValidator = new AttributeValidator({
          requiredSecurityLevel: 'high'
        })

        const attribute = {
          ...createTestComputedAttribute(),
          security: {
            ...createTestComputedAttribute().security,
            allowExternalRequests: true
          }
        }

        const result = await customValidator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('additional security review'))).toBe(true)
      })

      test('should validate timeout settings', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          security: {
            ...createTestComputedAttribute().security,
            timeout: 60000 // 60 seconds
          }
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('exceeds recommended maximum'))).toBe(true)
      })

      test('should validate memory usage limits', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          security: {
            ...createTestComputedAttribute().security,
            maxMemoryUsage: 200 * 1024 * 1024 // 200MB
          }
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('Memory limit'))).toBe(true)
      })
    })

    describe('Performance Validation', () => {
      test('should warn about disabled caching', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          caching: {
            ...createTestComputedAttribute().caching,
            enabled: false
          }
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('Caching is disabled'))).toBe(true)
      })

      test('should warn about short cache TTL', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          caching: {
            ...createTestComputedAttribute().caching,
            ttl: 30 // 30 seconds
          }
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('Very short cache TTL'))).toBe(true)
      })

      test('should warn about long cache TTL', async () => {
        const attribute = {
          ...createTestComputedAttribute(),
          caching: {
            ...createTestComputedAttribute().caching,
            ttl: 100000 // Very long
          }
        }

        const result = await validator.validateAttribute(attribute, validationContext)

        expect(result.warnings.some(w => w.message.includes('Very long cache TTL'))).toBe(true)
      })
    })

    describe('Business Logic Validation', () => {
      test('should detect duplicate attribute IDs', async () => {
        const existingAttribute = createTestComputedAttribute()
        const context = {
          ...validationContext,
          existingAttributes: [existingAttribute]
        }

        const duplicateAttribute = {
          ...createTestComputedAttribute(),
          name: 'Different Name'
        }

        const result = await validator.validateAttribute(duplicateAttribute, context)

        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.message.includes('already exists'))).toBe(true)
      })

      test('should warn about similar attribute names', async () => {
        const existingAttribute = {
          ...createTestComputedAttribute(),
          id: 'different_id'
        }
        const context = {
          ...validationContext,
          existingAttributes: [existingAttribute]
        }

        const similarAttribute = {
          ...createTestComputedAttribute(),
          id: 'another_id',
          name: 'USER SCORE' // Same name, different case
        }

        const result = await validator.validateAttribute(similarAttribute, context)

        expect(result.warnings.some(w => w.message.includes('Similar attribute name exists'))).toBe(true)
      })
    })
  })

  describe('SchemaIntegration', () => {
    let integration: SchemaIntegration

    beforeEach(() => {
      integration = new SchemaIntegration()
    })

    describe('Configuration', () => {
      test('should initialize with default configuration', () => {
        const config = integration.getConfig()
        expect(config.enableAutoValidation).toBe(DEFAULT_SCHEMA_INTEGRATION_CONFIG.enableAutoValidation)
        expect(config.enableSchemaVersioning).toBe(DEFAULT_SCHEMA_INTEGRATION_CONFIG.enableSchemaVersioning)
      })

      test('should update configuration', () => {
        integration.updateConfig({ enableAutoValidation: false })
        const config = integration.getConfig()
        expect(config.enableAutoValidation).toBe(false)
      })
    })

    describe('Collection Integration', () => {
      test('should integrate computed attributes with collection', async () => {
        const baseSchema = createTestSchema()
        const computedAttribute = createTestComputedAttribute()

        const result = await integration.integrateWithCollection(
          'users',
          baseSchema,
          [computedAttribute]
        )

        expect(result.success).toBe(true)
        expect(result.collectionName).toBe('users')
        expect(result.addedAttributes).toContain('user_score')
        expect(result.errors).toHaveLength(0)
      })

      test('should handle validation errors', async () => {
        const baseSchema = createTestSchema()
        const invalidAttribute = {
          ...createTestComputedAttribute(),
          id: ''
        }

        const result = await integration.integrateWithCollection(
          'users',
          baseSchema,
          [invalidAttribute]
        )

        expect(result.success).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })

      test('should handle schema extension errors', async () => {
        const invalidSchema: BaseCollectionSchema = {
          name: '',
          fields: {}
        }
        const computedAttribute = createTestComputedAttribute()

        const result = await integration.integrateWithCollection(
          'users',
          invalidSchema,
          [computedAttribute]
        )

        expect(result.success).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })

    describe('Schema Versioning', () => {
      test('should create schema versions', async () => {
        const baseSchema = createTestSchema()
        const computedAttribute = createTestComputedAttribute()

        const result = await integration.integrateWithCollection(
          'users',
          baseSchema,
          [computedAttribute]
        )

        expect(result.success).toBe(true)
        expect(result.schemaVersion).toBe(1)

        const versions = integration.getSchemaVersions('users')
        expect(versions).toHaveLength(1)
        expect(versions[0].version).toBe(1)
      })

      test('should increment version numbers', async () => {
        const baseSchema = createTestSchema()
        const attribute1 = createTestComputedAttribute()
        const attribute2 = {
          ...createTestComputedAttribute(),
          id: 'user_level',
          name: 'User Level'
        }

        // First integration
        await integration.integrateWithCollection('users', baseSchema, [attribute1])

        // Second integration
        const result2 = await integration.integrateWithCollection('users', baseSchema, [attribute2])

        expect(result2.schemaVersion).toBe(2)

        const versions = integration.getSchemaVersions('users')
        expect(versions).toHaveLength(2)
      })
    })

    describe('Schema Cache', () => {
      test('should cache extended schemas', async () => {
        const baseSchema = createTestSchema()
        const computedAttribute = createTestComputedAttribute()

        await integration.integrateWithCollection('users', baseSchema, [computedAttribute])

        const cachedSchema = await integration.getExtendedSchema('users')
        expect(cachedSchema).toBeDefined()
        expect(cachedSchema!.computedAttributes).toBeDefined()
        expect(cachedSchema!.computedAttributes!['user_score']).toBeDefined()
      })

      test('should clear cache', async () => {
        const baseSchema = createTestSchema()
        const computedAttribute = createTestComputedAttribute()

        await integration.integrateWithCollection('users', baseSchema, [computedAttribute])
        integration.clearCache()

        const cachedSchema = await integration.getExtendedSchema('users')
        expect(cachedSchema).toBeUndefined()
      })
    })

    describe('Attribute Updates', () => {
      test('should add new attributes', async () => {
        const baseSchema = createTestSchema()
        const initialAttribute = createTestComputedAttribute()

        // Initial integration
        await integration.integrateWithCollection('users', baseSchema, [initialAttribute])

        // Add new attribute
        const newAttribute = {
          ...createTestComputedAttribute(),
          id: 'user_level',
          name: 'User Level'
        }

        const result = await integration.updateComputedAttributes('users', {
          add: [newAttribute]
        })

        expect(result.success).toBe(true)
        expect(result.addedAttributes).toContain('user_level')
      })

      test('should remove attributes', async () => {
        const baseSchema = createTestSchema()
        const attribute1 = createTestComputedAttribute()
        const attribute2 = {
          ...createTestComputedAttribute(),
          id: 'user_level',
          name: 'User Level'
        }

        // Initial integration with two attributes
        await integration.integrateWithCollection('users', baseSchema, [attribute1, attribute2])

        // Remove one attribute
        const result = await integration.updateComputedAttributes('users', {
          remove: ['user_level']
        })

        expect(result.success).toBe(true)
        expect(result.migrationRequired).toBe(true)
      })

      test('should modify attributes', async () => {
        const baseSchema = createTestSchema()
        const initialAttribute = createTestComputedAttribute()

        // Initial integration
        await integration.integrateWithCollection('users', baseSchema, [initialAttribute])

        // Modify attribute
        const modifiedAttribute = {
          ...initialAttribute,
          name: 'Modified User Score',
          description: 'Updated description'
        }

        const result = await integration.updateComputedAttributes('users', {
          modify: [{ id: 'user_score', definition: modifiedAttribute }]
        })

        expect(result.success).toBe(true)
        expect(result.migrationRequired).toBe(true)
      })
    })
  })

  describe('BuiltInAttributes', () => {
    describe('User-level Attributes', () => {
      test('should provide user-level attributes', () => {
        const userAttributes = BuiltInAttributes.getUserLevelAttributes()

        expect(userAttributes.length).toBeGreaterThan(0)
        expect(userAttributes.every(attr => attr.targetType === 'user')).toBe(true)
        expect(userAttributes.some(attr => attr.id === 'user_profile_completeness')).toBe(true)
        expect(userAttributes.some(attr => attr.id === 'user_security_score')).toBe(true)
      })

      test('should have valid user attribute definitions', () => {
        const userAttributes = BuiltInAttributes.getUserLevelAttributes()

        for (const attr of userAttributes) {
          expect(attr.id).toBeTruthy()
          expect(attr.name).toBeTruthy()
          expect(attr.description).toBeTruthy()
          expect(attr.computeFunction).toBeInstanceOf(Function)
          expect(attr.caching).toBeDefined()
          expect(attr.security).toBeDefined()
        }
      })
    })

    describe('Document-level Attributes', () => {
      test('should provide document-level attributes', () => {
        const documentAttributes = BuiltInAttributes.getDocumentLevelAttributes()

        expect(documentAttributes.length).toBeGreaterThan(0)
        expect(documentAttributes.every(attr => attr.targetType === 'document')).toBe(true)
        expect(documentAttributes.some(attr => attr.id === 'document_size')).toBe(true)
        expect(documentAttributes.some(attr => attr.id === 'document_age')).toBe(true)
      })
    })

    describe('Collection-level Attributes', () => {
      test('should provide collection-level attributes', () => {
        const collectionAttributes = BuiltInAttributes.getCollectionLevelAttributes()

        expect(collectionAttributes.length).toBeGreaterThan(0)
        expect(collectionAttributes.every(attr => attr.targetType === 'collection')).toBe(true)
        expect(collectionAttributes.some(attr => attr.id === 'collection_document_count')).toBe(true)
        expect(collectionAttributes.some(attr => attr.id === 'collection_health_score')).toBe(true)
      })
    })

    describe('Database-level Attributes', () => {
      test('should provide database-level attributes', () => {
        const databaseAttributes = BuiltInAttributes.getDatabaseLevelAttributes()

        expect(databaseAttributes.length).toBeGreaterThan(0)
        expect(databaseAttributes.every(attr => attr.targetType === 'database')).toBe(true)
        expect(databaseAttributes.some(attr => attr.id === 'database_size')).toBe(true)
        expect(databaseAttributes.some(attr => attr.id === 'database_performance_score')).toBe(true)
      })
    })

    describe('Utility Methods', () => {
      test('should get all built-in attributes', () => {
        const allAttributes = BuiltInAttributes.getAllBuiltInAttributes()

        expect(allAttributes.length).toBeGreaterThan(0)

        const userCount = BuiltInAttributes.getUserLevelAttributes().length
        const documentCount = BuiltInAttributes.getDocumentLevelAttributes().length
        const collectionCount = BuiltInAttributes.getCollectionLevelAttributes().length
        const databaseCount = BuiltInAttributes.getDatabaseLevelAttributes().length

        expect(allAttributes.length).toBe(userCount + documentCount + collectionCount + databaseCount)
      })

      test('should get attributes by target type', () => {
        const userAttributes = BuiltInAttributes.getAttributesByTargetType('user')
        const documentAttributes = BuiltInAttributes.getAttributesByTargetType('document')
        const collectionAttributes = BuiltInAttributes.getAttributesByTargetType('collection')
        const databaseAttributes = BuiltInAttributes.getAttributesByTargetType('database')

        expect(userAttributes.every(attr => attr.targetType === 'user')).toBe(true)
        expect(documentAttributes.every(attr => attr.targetType === 'document')).toBe(true)
        expect(collectionAttributes.every(attr => attr.targetType === 'collection')).toBe(true)
        expect(databaseAttributes.every(attr => attr.targetType === 'database')).toBe(true)
      })

      test('should get attribute by ID', () => {
        const attribute = BuiltInAttributes.getAttributeById('user_profile_completeness')

        expect(attribute).toBeDefined()
        expect(attribute!.id).toBe('user_profile_completeness')
        expect(attribute!.targetType).toBe('user')
      })

      test('should return undefined for non-existent attribute ID', () => {
        const attribute = BuiltInAttributes.getAttributeById('non_existent_attribute')

        expect(attribute).toBeUndefined()
      })
    })

    describe('Attribute Computation', () => {
      test('should compute user profile completeness', async () => {
        const attribute = BuiltInAttributes.getAttributeById('user_profile_completeness')!

        const mockContext = {
          target: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            address: '123 Main St',
            avatar: 'avatar.jpg'
          }
        } as any

        const result = await attribute.computeFunction(mockContext)
        expect(result).toBe(100) // All fields completed
      })

      test('should compute partial user profile completeness', async () => {
        const attribute = BuiltInAttributes.getAttributeById('user_profile_completeness')!

        const mockContext = {
          target: {
            name: 'John Doe',
            email: 'john@example.com'
            // Missing phone, address, avatar
          }
        } as any

        const result = await attribute.computeFunction(mockContext)
        expect(result).toBe(40) // 2 out of 5 fields completed
      })

      test('should compute document age', async () => {
        const attribute = BuiltInAttributes.getAttributeById('document_age')!

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const mockContext = {
          target: {
            createdAt: yesterday.toISOString()
          }
        } as any

        const result = await attribute.computeFunction(mockContext)
        expect(result).toBeGreaterThanOrEqual(1) // At least 1 day old
        expect(result).toBeLessThanOrEqual(2) // But not more than 2 days due to timing
      })

      test('should handle missing data gracefully', async () => {
        const attribute = BuiltInAttributes.getAttributeById('user_profile_completeness')!

        const mockContext = {
          target: null
        } as any

        const result = await attribute.computeFunction(mockContext)
        expect(result).toBe(0) // No user data
      })
    })
  })
})