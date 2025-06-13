import { describe, it, expect } from 'bun:test'

describe('Guide Project Compatibility', () => {
  it('should import all required MikroORM exports', async () => {
    const {
      MikroORM,
      EntityManager,
      EntityRepository,
      defineConfig,
      Entity,
      Property,
      PrimaryKey,
      ManyToOne,
      OneToMany,
      Collection,
      BeforeCreate,
      BeforeUpdate,
    } = await import('collection-store-mikro-orm')

    // Check that all required exports are available
    expect(MikroORM).toBeDefined()
    expect(EntityManager).toBeDefined()
    expect(EntityRepository).toBeDefined()
    expect(defineConfig).toBeDefined()
    expect(Entity).toBeDefined()
    expect(Property).toBeDefined()
    expect(PrimaryKey).toBeDefined()
    expect(ManyToOne).toBeDefined()
    expect(OneToMany).toBeDefined()
    expect(Collection).toBeDefined()
    expect(BeforeCreate).toBeDefined()
    expect(BeforeUpdate).toBeDefined()
  })

  it('should be able to create configuration', async () => {
    const { defineConfig } = await import('collection-store-mikro-orm')

    const config = defineConfig({
      entities: ['User', 'Article'],
      dbName: 'test-db',
      debug: false,
    })

    expect(config).toBeDefined()
    expect(config.entities).toEqual(['User', 'Article'])
    expect(config.dbName).toBe('test-db')
    expect(config.debug).toBe(false)
  })

  it('should be able to import db module', async () => {
    // This test ensures that our db.ts file can be imported without errors
    const dbModule = await import('../src/db.js')

    expect(dbModule.initORM).toBeDefined()
    expect(typeof dbModule.initORM).toBe('function')
  })
})