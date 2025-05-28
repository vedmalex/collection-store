import { describe, it, expect } from 'bun:test'
import { initTestORM } from './setup'
import { TestUser, TestPost } from './entities'

describe('CollectionStore MikroORM - Simple Tests', () => {
  it('should work with basic CRUD operations', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create
    const user = new TestUser()
    user.name = 'Test User'
    user.email = 'test@example.com'
    user.age = 30

    em.persist(user)
    await em.flush()

    expect(user.id).toBeDefined()

    // Read
    const foundUser = await em.findOne(TestUser, user.id)
    expect(foundUser).toBeDefined()
    expect(foundUser?.name).toBe('Test User')

    // Update
    if (foundUser) {
      foundUser.name = 'Updated User'
      await em.flush()
    }

    const updatedUser = await em.findOne(TestUser, user.id)
    expect(updatedUser?.name).toBe('Updated User')

    // Delete
    if (updatedUser) {
      em.remove(updatedUser)
      await em.flush()
    }

    const deletedUser = await em.findOne(TestUser, user.id)
    expect(deletedUser).toBeNull()
  })

  it('should work with relations', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Author'
    user.email = 'author@example.com'

    // Create post
    const post = new TestPost()
    post.title = 'Test Post'
    post.content = 'Test content'
    post.author = user

    em.persist(user)
    em.persist(post)
    await em.flush()

    expect(user.id).toBeDefined()
    expect(post.id).toBeDefined()

    // Find post with author
    const foundPost = await em.findOne(TestPost, post.id)
    expect(foundPost).toBeDefined()
    expect(foundPost?.author).toBe(user)
  })

  it('should handle simple transactions', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Successful transaction
    await em.transactional(async (em) => {
      const user = new TestUser()
      user.name = 'Transaction User'
      user.email = 'tx@example.com'

      em.persist(user)
      await em.flush()
    })

    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Transaction User')
  })
})