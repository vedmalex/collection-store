import { describe, it, expect } from 'bun:test'
import { initTestORM } from './setup'
import { TestUser, TestPost } from './entities'

describe('CollectionStore MikroORM - Schema Operations', () => {
  it('should create schema successfully', async () => {
    const orm = await initTestORM([TestUser, TestPost])

    // Schema should be created during initialization
    expect(await orm.isConnected()).toBe(true)

    // Test that we can create entities after schema creation
    const em = orm.em.fork()
    const user = new TestUser()
    user.name = 'Schema Test User'
    user.email = 'schema@example.com'

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()
  })

  it('should refresh database schema', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create some data
    const user = new TestUser()
    user.name = 'Before Refresh'
    user.email = 'before@example.com'

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()

    // Refresh database (should drop and recreate)
    await orm.schema.refreshDatabase()

    // Data should be gone after refresh
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(0)

    // But we should still be able to create new data
    const newUser = new TestUser()
    newUser.name = 'After Refresh'
    newUser.email = 'after@example.com'

    em.persist(newUser)
    await em.flush()

    expect(newUser.id).toBeDefined()
  })

  it('should update schema', async () => {
    const orm = await initTestORM([TestUser, TestPost])

    // Update schema should work without errors
    await orm.schema.updateSchema()

    // Test that entities still work after schema update
    const em = orm.em.fork()
    const user = new TestUser()
    user.name = 'Schema Update Test'
    user.email = 'update@example.com'

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()
  })

  it('should ensure indexes', async () => {
    const orm = await initTestORM([TestUser, TestPost])

    // Ensure indexes should work without errors
    await orm.schema.ensureIndexes()

    // Test that entities still work after ensuring indexes
    const em = orm.em.fork()
    const user = new TestUser()
    user.name = 'Index Test User'
    user.email = 'index@example.com'

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()
  })

  it('should drop schema', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create some data first
    const user = new TestUser()
    user.name = 'To Be Dropped'
    user.email = 'drop@example.com'

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()

    // Drop schema
    await orm.schema.dropSchema()

    // Recreate schema to test functionality
    await orm.schema.createSchema()

    // Data should be gone after drop
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(0)
  })

  it('should handle schema operations with options', async () => {
    const orm = await initTestORM([TestUser, TestPost])

    // Test schema operations with various options
    await orm.schema.createSchema()
    await orm.schema.updateSchema()
    await orm.schema.ensureIndexes()
    await orm.schema.dropSchema({ dropMigrationsTable: true })

    // Recreate for final test
    await orm.schema.createSchema()

    const em = orm.em.fork()
    const user = new TestUser()
    user.name = 'Options Test'
    user.email = 'options@example.com'

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()
  })

  it('should work with multiple entities', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Multi Entity User'
    user.email = 'multi@example.com'

    // Create post
    const post = new TestPost()
    post.title = 'Multi Entity Post'
    post.content = 'Content for multi entity test'
    post.author = user

    em.persist(user)
    em.persist(post)
    await em.flush()

    expect(user.id).toBeDefined()
    expect(post.id).toBeDefined()

    // Verify both collections exist and work
    const users = await em.find(TestUser, {})
    const posts = await em.find(TestPost, {})

    expect(users).toHaveLength(1)
    expect(posts).toHaveLength(1)
    expect(posts[0].author).toBe(user)
  })

  it('should handle schema generator registration', async () => {
    const orm = await initTestORM([TestUser, TestPost])

    // Schema generator should be registered and working
    const generator = orm.schema
    expect(generator).toBeDefined()

    // Test that generator methods are available
    expect(typeof generator.createSchema).toBe('function')
    expect(typeof generator.dropSchema).toBe('function')
    expect(typeof generator.updateSchema).toBe('function')
    expect(typeof generator.refreshDatabase).toBe('function')
    expect(typeof generator.ensureIndexes).toBe('function')
  })
})