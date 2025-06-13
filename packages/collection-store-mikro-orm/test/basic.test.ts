import { describe, it, expect } from 'bun:test'
import { initTestORM } from './setup'
import { TestUser, TestPost } from './entities'

describe('CollectionStore MikroORM - Basic Operations', () => {
  it('should initialize ORM successfully', async () => {
    const orm = await initTestORM([TestUser, TestPost])

    expect(orm).toBeDefined()
    expect(await orm.isConnected()).toBe(true)
  })

  it('should create and persist entity', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    const user = new TestUser()
    user.name = 'John Doe'
    user.email = 'john@example.com'
    user.age = 30

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()
    expect(user.name).toBe('John Doe')
    expect(user.email).toBe('john@example.com')
    expect(user.age).toBe(30)
    expect(user.isActive).toBe(true)
  })

  it('should find entity by id', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Jane Doe'
    user.email = 'jane@example.com'

    em.persist(user)
    await em.flush()

    const userId = user.id

    // Find user
    const foundUser = await em.findOne(TestUser, userId)

    expect(foundUser).toBeDefined()
    expect(foundUser?.name).toBe('Jane Doe')
    expect(foundUser?.email).toBe('jane@example.com')
  })

  it('should find entities with where conditions', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users
    const users = [
      { name: 'Alice', email: 'alice@example.com', age: 25 },
      { name: 'Bob', email: 'bob@example.com', age: 35 },
      { name: 'Charlie', email: 'charlie@example.com', age: 25 },
    ]

    for (const userData of users) {
      const user = new TestUser()
      Object.assign(user, userData)
      em.persist(user)
    }

    await em.flush()

    // Find users by age
    const youngUsers = await em.find(TestUser, { age: 25 })

    expect(youngUsers).toHaveLength(2)
    expect(youngUsers.map(u => u.name).sort()).toEqual(['Alice', 'Charlie'])
  })

  it('should update entity', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Original Name'
    user.email = 'original@example.com'

    em.persist(user)
    await em.flush()

    const userId = user.id

    // Update user
    const foundUser = await em.findOne(TestUser, userId)
    if (foundUser) {
      foundUser.name = 'Updated Name'
      foundUser.email = 'updated@example.com'
      await em.flush()
    }

    // Verify update
    const updatedUser = await em.findOne(TestUser, userId)
    expect(updatedUser?.name).toBe('Updated Name')
    expect(updatedUser?.email).toBe('updated@example.com')
  })

  it('should delete entity', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'To Delete'
    user.email = 'delete@example.com'

    em.persist(user)
    await em.flush()

    const userId = user.id

    // Delete user
    const foundUser = await em.findOne(TestUser, userId)
    if (foundUser) {
      em.remove(foundUser)
      await em.flush()
    }

    // Verify deletion
    const deletedUser = await em.findOne(TestUser, userId)
    expect(deletedUser).toBeNull()
  })

  it('should count entities', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users
    for (let i = 0; i < 5; i++) {
      const user = new TestUser()
      user.name = `User ${i}`
      user.email = `user${i}@example.com`
      em.persist(user)
    }

    await em.flush()

    const count = await em.count(TestUser, {})
    expect(count).toBe(5)

    const activeCount = await em.count(TestUser, { isActive: true })
    expect(activeCount).toBe(5)
  })
})