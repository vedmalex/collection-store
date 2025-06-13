import { describe, it, expect } from 'bun:test'
import { initTestORM } from './setup'
import { TestUser, TestPost } from './entities'

describe('CollectionStore MikroORM - Transactions', () => {
  it('should commit transaction successfully', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    await em.transactional(async (em) => {
      const user = new TestUser()
      user.name = 'Transaction User'
      user.email = 'transaction@example.com'

      em.persist(user)
      await em.flush()

      expect(user.id).toBeDefined()
    })

    // Verify user was persisted after transaction
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Transaction User')
  })

  it('should rollback transaction on error', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    try {
      await em.transactional(async (em) => {
        const user = new TestUser()
        user.name = 'Rollback User'
        user.email = 'rollback@example.com'

        em.persist(user)
        await em.flush()

        // Simulate error
        throw new Error('Transaction error')
      })
    } catch (error) {
      expect(error.message).toBe('Transaction error')
    }

    // Verify user was not persisted after rollback
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(0)
  })

  it('should handle nested transactions', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    await em.transactional(async (em) => {
      const user1 = new TestUser()
      user1.name = 'Outer User'
      user1.email = 'outer@example.com'

      em.persist(user1)
      await em.flush()

      await em.transactional(async (em) => {
        const user2 = new TestUser()
        user2.name = 'Inner User'
        user2.email = 'inner@example.com'

        em.persist(user2)
        await em.flush()
      })
    })

    // Verify both users were persisted
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(2)
    expect(users.map(u => u.name).sort()).toEqual(['Inner User', 'Outer User'])
  })

  it('should rollback nested transaction on inner error', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    try {
      await em.transactional(async (em) => {
        const user1 = new TestUser()
        user1.name = 'Outer User'
        user1.email = 'outer@example.com'

        em.persist(user1)
        await em.flush()

        await em.transactional(async (em) => {
          const user2 = new TestUser()
          user2.name = 'Inner User'
          user2.email = 'inner@example.com'

          em.persist(user2)
          await em.flush()

          // Simulate error in nested transaction
          throw new Error('Inner transaction error')
        })
      })
    } catch (error) {
      expect(error.message).toBe('Inner transaction error')
    }

    // Verify no users were persisted due to rollback
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(0)
  })

  it('should handle multiple operations in transaction', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    await em.transactional(async (em) => {
      // Create user
      const user = new TestUser()
      user.name = 'Multi Op User'
      user.email = 'multiop@example.com'
      user.age = 30

      em.persist(user)
      await em.flush()

      // Create posts for user
      const post1 = new TestPost()
      post1.title = 'First Post'
      post1.content = 'Content 1'
      post1.author = user

      const post2 = new TestPost()
      post2.title = 'Second Post'
      post2.content = 'Content 2'
      post2.author = user

      em.persist(post1)
      em.persist(post2)
      await em.flush()

      // Update user
      user.age = 31
      await em.flush()
    })

    // Verify all operations were committed
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Multi Op User')
    expect(users[0].age).toBe(31)

    const posts = await em.find(TestPost, {})
    expect(posts).toHaveLength(2)
    expect(posts.map(p => p.title).sort()).toEqual(['First Post', 'Second Post'])
  })

  it('should isolate transactions', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em1 = orm.em.fork()
    const em2 = orm.em.fork()

    // Start first transaction
    await em1.transactional(async (em) => {
      const user = new TestUser()
      user.name = 'Transaction 1 User'
      user.email = 'tx1@example.com'

      em.persist(user)
      await em.flush()
    })

    // Start second transaction (after first completes)
    await em2.transactional(async (em) => {
      const user = new TestUser()
      user.name = 'Transaction 2 User'
      user.email = 'tx2@example.com'

      em.persist(user)
      await em.flush()
    })

    // Verify both users were persisted
    const users = await em1.find(TestUser, {})
    expect(users).toHaveLength(2)
    expect(users.map(u => u.name).sort()).toEqual(['Transaction 1 User', 'Transaction 2 User'])
  })

  it('should handle transaction with custom isolation level', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    await em.transactional(async (em) => {
      const user = new TestUser()
      user.name = 'Isolation User'
      user.email = 'isolation@example.com'

      em.persist(user)
      await em.flush()
    }, {
      isolationLevel: 'read committed' as any
    })

    // Verify user was persisted
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Isolation User')
  })
})