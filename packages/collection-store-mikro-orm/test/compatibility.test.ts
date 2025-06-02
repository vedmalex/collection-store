import { describe, it, expect } from 'bun:test'

describe('Collection Store MikroORM Compatibility', () => {
  describe('Core MikroORM Exports', () => {
    it('should export all essential MikroORM decorators', async () => {
      const {
        Entity,
        Property,
        PrimaryKey,
        ManyToOne,
        OneToMany,
        ManyToMany,
        OneToOne,
        Embeddable,
        Embedded,
        BeforeCreate,
        BeforeUpdate,
        BeforeDelete,
        AfterCreate,
        AfterUpdate,
        AfterDelete,
        Index,
        Unique,
        Collection,
        Reference,
        ref,
        wrap,
      } = await import('../src/index')

      // Check decorators
      expect(Entity).toBeDefined()
      expect(Property).toBeDefined()
      expect(PrimaryKey).toBeDefined()
      expect(ManyToOne).toBeDefined()
      expect(OneToMany).toBeDefined()
      expect(ManyToMany).toBeDefined()
      expect(OneToOne).toBeDefined()
      expect(Embeddable).toBeDefined()
      expect(Embedded).toBeDefined()

      // Check lifecycle hooks
      expect(BeforeCreate).toBeDefined()
      expect(BeforeUpdate).toBeDefined()
      expect(BeforeDelete).toBeDefined()
      expect(AfterCreate).toBeDefined()
      expect(AfterUpdate).toBeDefined()
      expect(AfterDelete).toBeDefined()

      // Check constraints
      expect(Index).toBeDefined()
      expect(Unique).toBeDefined()

      // Check utilities
      expect(Collection).toBeDefined()
      expect(Reference).toBeDefined()
      expect(ref).toBeDefined()
      expect(wrap).toBeDefined()
    })

    it('should export all essential MikroORM types', async () => {
      const module = await import('../src/index')

      // Check that we can access type-only exports (they won't be defined at runtime)
      // This test mainly ensures the imports don't fail
      expect(module).toBeDefined()
    })

    it('should export Collection Store specific classes', async () => {
      const {
        CollectionStoreDriver,
        CollectionStoreConnection,
        CollectionStorePlatform,
        CollectionStoreEntityManager,
        CollectionStoreEntityRepository,
        CollectionStoreMikroORM,
        CollectionStoreSchemaGenerator,
      } = await import('../src/index')

      expect(CollectionStoreDriver).toBeDefined()
      expect(CollectionStoreConnection).toBeDefined()
      expect(CollectionStorePlatform).toBeDefined()
      expect(CollectionStoreEntityManager).toBeDefined()
      expect(CollectionStoreEntityRepository).toBeDefined()
      expect(CollectionStoreMikroORM).toBeDefined()
      expect(CollectionStoreSchemaGenerator).toBeDefined()
    })

    it('should export Collection Store specific aliases', async () => {
      const {
        MikroORM,
        EntityManager,
        EntityRepository,
        defineConfig,
      } = await import('../src/index')

      expect(MikroORM).toBeDefined()
      expect(EntityManager).toBeDefined()
      expect(EntityRepository).toBeDefined()
      expect(defineConfig).toBeDefined()
    })

    it('should export error types', async () => {
      const {
        CollectionStoreError,
        CollectionStoreValidationError,
        CollectionStoreNotFoundError,
        CollectionStoreConnectionError,
        CollectionStoreTransactionError,
        CollectionStoreSavepointError,
      } = await import('../src/index')

      expect(CollectionStoreError).toBeDefined()
      expect(CollectionStoreValidationError).toBeDefined()
      expect(CollectionStoreNotFoundError).toBeDefined()
      expect(CollectionStoreConnectionError).toBeDefined()
      expect(CollectionStoreTransactionError).toBeDefined()
      expect(CollectionStoreSavepointError).toBeDefined()
    })
  })

  describe('Configuration Helper', () => {
    it('should create valid configuration with defaults', async () => {
      const { defineConfig } = await import('../src/index')

      const config = defineConfig()

      expect(config).toBeDefined()
      expect(config.dbName).toBe(':memory:')
      expect(config.debug).toBe(true)
      expect(config.entities).toEqual([])
      expect(config.entitiesTs).toEqual(['src/**/*.entity.ts'])
    })

    it('should merge user options with defaults', async () => {
      const { defineConfig } = await import('../src/index')

      const config = defineConfig({
        dbName: 'test-db',
        debug: false,
        entities: ['User', 'Post'],
      })

      expect(config.dbName).toBe('test-db')
      expect(config.debug).toBe(false)
      expect(config.entities).toEqual(['User', 'Post'])
      expect(config.entitiesTs).toEqual(['src/**/*.entity.ts']) // default
    })
  })

  describe('Error Types', () => {
    it('should create proper error instances', async () => {
      const {
        CollectionStoreError,
        CollectionStoreValidationError,
        CollectionStoreNotFoundError,
      } = await import('../src/index')

      const baseError = new CollectionStoreError('Test error', 'TEST_CODE')
      expect(baseError.message).toBe('Test error')
      expect(baseError.code).toBe('TEST_CODE')
      expect(baseError.name).toBe('CollectionStoreError')

      const validationError = new CollectionStoreValidationError('Validation failed', [])
      expect(validationError.message).toBe('Validation failed')
      expect(validationError.code).toBe('VALIDATION_ERROR')
      expect(validationError.name).toBe('CollectionStoreValidationError')

      const notFoundError = new CollectionStoreNotFoundError('User', { id: 1 })
      expect(notFoundError.message).toContain('User not found')
      expect(notFoundError.code).toBe('NOT_FOUND')
      expect(notFoundError.name).toBe('CollectionStoreNotFoundError')
    })
  })
})