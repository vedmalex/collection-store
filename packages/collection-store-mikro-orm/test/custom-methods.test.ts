import { describe, it, expect } from 'bun:test'
import { initTestORM } from './setup'
import { TestUser, TestPost } from './entities'

describe('CollectionStore MikroORM - Custom Methods', () => {
  it('should use first() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users
    const users = [
      { name: 'Alice', email: 'alice@example.com', age: 25 },
      { name: 'Bob', email: 'bob@example.com', age: 35 },
      { name: 'Charlie', email: 'charlie@example.com', age: 30 },
    ]

    for (const userData of users) {
      const user = new TestUser()
      Object.assign(user, userData)
      em.persist(user)
    }

    await em.flush()

    // Test first method
    const firstUser = await em.first(TestUser)
    expect(firstUser).toBeDefined()
    expect(firstUser.name).toBe('Alice') // Should be first inserted
  })

  it('should use last() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users
    const users = [
      { name: 'Alice', email: 'alice@example.com', age: 25 },
      { name: 'Bob', email: 'bob@example.com', age: 35 },
      { name: 'Charlie', email: 'charlie@example.com', age: 30 },
    ]

    for (const userData of users) {
      const user = new TestUser()
      Object.assign(user, userData)
      em.persist(user)
    }

    await em.flush()

    // Test last method
    const lastUser = await em.last(TestUser)
    expect(lastUser).toBeDefined()
    expect(lastUser.name).toBe('Charlie') // Should be last inserted
  })

  it('should use findById() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Test User'
    user.email = 'test@example.com'

    em.persist(user)
    await em.flush()

    const userId = user.id

    // Test findById method
    const foundUser = await em.findById(TestUser, userId)
    expect(foundUser).toBeDefined()
    expect(foundUser.name).toBe('Test User')
    expect(foundUser.id).toBe(userId)
  })

  it('should use findBy() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users with same age
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

    // Test findBy method
    const youngUsers = await em.findBy(TestUser, 'age', 25)
    expect(youngUsers).toHaveLength(2)
    expect(youngUsers.map(u => u.name).sort()).toEqual(['Alice', 'Charlie'])
  })

  it('should use findFirstBy() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users with same age
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

    // Test findFirstBy method
    const firstYoungUser = await em.findFirstBy(TestUser, 'age', 25)
    expect(firstYoungUser).toBeDefined()
    expect(firstYoungUser.name).toBe('Alice') // Should be first with age 25
    expect(firstYoungUser.age).toBe(25)
  })

  it('should use findLastBy() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create multiple users with same age
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

    // Test findLastBy method
    const lastYoungUser = await em.findLastBy(TestUser, 'age', 25)
    expect(lastYoungUser).toBeDefined()
    expect(lastYoungUser.name).toBe('Charlie') // Should be last with age 25
    expect(lastYoungUser.age).toBe(25)
  })

  it('should use lowest() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create users with different ages
    const users = [
      { name: 'Alice', email: 'alice@example.com', age: 25 },
      { name: 'Bob', email: 'bob@example.com', age: 35 },
      { name: 'Charlie', email: 'charlie@example.com', age: 20 },
    ]

    for (const userData of users) {
      const user = new TestUser()
      Object.assign(user, userData)
      em.persist(user)
    }

    await em.flush()

    // Test lowest method
    const youngestUser = await em.lowest(TestUser, 'age')
    expect(youngestUser).toBeDefined()
    expect(youngestUser.name).toBe('Charlie')
    expect(youngestUser.age).toBe(20)
  })

  it('should use greatest() method', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create users with different ages
    const users = [
      { name: 'Alice', email: 'alice@example.com', age: 25 },
      { name: 'Bob', email: 'bob@example.com', age: 35 },
      { name: 'Charlie', email: 'charlie@example.com', age: 20 },
    ]

    for (const userData of users) {
      const user = new TestUser()
      Object.assign(user, userData)
      em.persist(user)
    }

    await em.flush()

    // Test greatest method
    const oldestUser = await em.greatest(TestUser, 'age')
    expect(oldestUser).toBeDefined()
    expect(oldestUser.name).toBe('Bob')
    expect(oldestUser.age).toBe(35)
  })

  it('should use oldest() and latest() methods', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create users with delays to ensure different timestamps
    const user1 = new TestUser()
    user1.name = 'First User'
    user1.email = 'first@example.com'
    em.persist(user1)
    await em.flush()

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 10))

    const user2 = new TestUser()
    user2.name = 'Second User'
    user2.email = 'second@example.com'
    em.persist(user2)
    await em.flush()

    // Test oldest method
    const oldestUser = await em.oldest(TestUser)
    expect(oldestUser).toBeDefined()
    expect(oldestUser.name).toBe('First User')

    // Test latest method
    const latestUser = await em.latest(TestUser)
    expect(latestUser).toBeDefined()
    expect(latestUser.name).toBe('Second User')
  })

  it('should work with repository methods', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Repository Test'
    user.email = 'repo@example.com'
    user.age = 30

    em.persist(user)
    await em.flush()

    // Get repository and test custom methods
    const userRepo = em.getRepository(TestUser)

    const firstUser = await userRepo.first()
    expect(firstUser).toBeDefined()
    expect(firstUser!.name).toBe('Repository Test')

    const foundUser = await userRepo.findById(user.id)
    expect(foundUser).toBeDefined()
    expect(foundUser!.id).toBe(user.id)

    const collection = userRepo.getCollection()
    expect(collection).toBeDefined()
  })
})