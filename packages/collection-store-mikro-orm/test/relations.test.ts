import { describe, it, expect } from 'bun:test'
import { initTestORM } from './setup'
import { TestUser, TestPost } from './entities'

describe('CollectionStore MikroORM - Relations', () => {
  it('should create entities with ManyToOne relation', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Author'
    user.email = 'author@example.com'

    // Create post
    const post = new TestPost()
    post.title = 'Test Post'
    post.content = 'This is a test post content'
    post.author = user

    em.persist(user)
    em.persist(post)
    await em.flush()

    expect(user.id).toBeDefined()
    expect(post.id).toBeDefined()
    expect(post.author).toBe(user)
  })

  it('should load ManyToOne relation', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user and post
    const user = new TestUser()
    user.name = 'Author'
    user.email = 'author@example.com'

    const post = new TestPost()
    post.title = 'Test Post'
    post.content = 'Content'
    post.author = user

    em.persist(user)
    em.persist(post)
    await em.flush()

    const postId = post.id

    // Clear entity manager and load post with author
    em.clear()

    const loadedPost = await em.findOne(TestPost, postId, {
      populate: ['author']
    })

    expect(loadedPost).toBeDefined()
    expect(loadedPost?.author).toBeDefined()
    expect(loadedPost?.author.name).toBe('Author')
  })

  it('should work with OneToMany collection', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user
    const user = new TestUser()
    user.name = 'Prolific Author'
    user.email = 'prolific@example.com'

    // Create multiple posts
    const post1 = new TestPost()
    post1.title = 'First Post'
    post1.content = 'First content'
    post1.author = user

    const post2 = new TestPost()
    post2.title = 'Second Post'
    post2.content = 'Second content'
    post2.author = user

    em.persist(user)
    em.persist(post1)
    em.persist(post2)
    await em.flush()

    const userId = user.id

    // Load user with posts
    em.clear()
    const loadedUser = await em.findOne(TestUser, userId, {
      populate: ['posts']
    })

    expect(loadedUser).toBeDefined()
    expect(loadedUser?.posts).toBeDefined()

    // Initialize collection if needed
    await loadedUser?.posts.init()

    expect(loadedUser?.posts.length).toBe(2)
    expect(loadedUser?.posts.getItems().map(p => p.title).sort()).toEqual(['First Post', 'Second Post'])
  })

  it('should find posts by author', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create users
    const author1 = new TestUser()
    author1.name = 'Author One'
    author1.email = 'author1@example.com'

    const author2 = new TestUser()
    author2.name = 'Author Two'
    author2.email = 'author2@example.com'

    // Create posts
    const post1 = new TestPost()
    post1.title = 'Post by Author 1'
    post1.content = 'Content 1'
    post1.author = author1

    const post2 = new TestPost()
    post2.title = 'Another Post by Author 1'
    post2.content = 'Content 2'
    post2.author = author1

    const post3 = new TestPost()
    post3.title = 'Post by Author 2'
    post3.content = 'Content 3'
    post3.author = author2

    em.persist(author1)
    em.persist(author2)
    em.persist(post1)
    em.persist(post2)
    em.persist(post3)
    await em.flush()

    // Find posts by author1
    const author1Posts = await em.find(TestPost, { author: author1.id })

    expect(author1Posts).toHaveLength(2)
    expect(author1Posts.map(p => p.title).sort()).toEqual([
      'Another Post by Author 1',
      'Post by Author 1'
    ])

    // Find posts by author2
    const author2Posts = await em.find(TestPost, { author: author2.id })

    expect(author2Posts).toHaveLength(1)
    expect(author2Posts[0].title).toBe('Post by Author 2')
  })

  it('should handle cascade operations', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    // Create user with posts
    const user = new TestUser()
    user.name = 'User to Delete'
    user.email = 'delete@example.com'

    const post = new TestPost()
    post.title = 'Post to be orphaned'
    post.content = 'Content'
    post.author = user

    em.persist(user)
    em.persist(post)
    await em.flush()

    const userId = user.id
    const postId = post.id

    // Delete user
    em.remove(user)
    await em.flush()

    // Check that user is deleted
    const deletedUser = await em.findOne(TestUser, userId)
    expect(deletedUser).toBeNull()

    // Post should still exist (no cascade delete configured)
    const orphanedPost = await em.findOne(TestPost, postId)
    expect(orphanedPost).toBeDefined()
  })
})