import { Article } from './modules/article/article.entity.js'
import { Tag } from './modules/article/tag.entity.js'
import { User } from './modules/user/user.entity.js'
import {
  CollectionStoreDriver,
  LoadStrategy,
  MikroORM,
} from 'collection-store-mikro-orm'

// initialize the ORM, loading the config file dynamically
const orm = await MikroORM.init({
  entities: [Article, User, Tag],
  driver: CollectionStoreDriver,
  dbName: 'user-db',
})
// recreate the database schema
await orm.schema.refreshDatabase()

// fork first to have a separate context
const em = orm.em.fork()

// create new user entity instance
const user = new User('Foo Bar', 'foo@bar.com', '123456')
console.log(user)

// first mark the entity with `persist()`, then `flush()`
await em.persist(user).flush()

// clear the context to simulate fresh request
em.clear()

const article = em.create(Article, {
  title: 'Foo is Bar',
  text: 'Lorem impsum dolor sit amet',
  author: user,
})

await em.persist(article).flush()

// clear the context to simulate fresh request
em.clear()

// find article by id and populate its author
const articleWithAuthor = await em.findOne(Article, article.id, {
  populate: ['author', 'text'],
  strategy: LoadStrategy.JOINED,
})
console.log(articleWithAuthor)

{
  // clear the context to simulate fresh request
  em.clear()

  // populating User.articles collection
  const user_1 = await em.findOneOrFail(User, user.id, {
    populate: ['articles'],
  })
  console.log(user_1)

  // or you could lazy load the collection later via `init()` method
  if (!user_1.articles.isInitialized()) {
    await user_1.articles.init()
  }

  // to ensure collection is loaded (but do nothing if it already is), use `loadItems()` method
  await user_1.articles.loadItems()

  for (const article of user_1.articles) {
    console.log(article.title)
    console.log(article.author.fullName) // the `article.author` is linked automatically thanks to the Identity Map
  }
  // create some tags and assign them to the first article
  const [article] = user_1.articles
  const newTag = em.create(Tag, { name: 'new' })
  const oldTag = em.create(Tag, { name: 'old' })
  article.tags.add(newTag, oldTag)
  debugger
  await em.flush()
  console.log(article.tags)

  // to remove items from collection, we first need to initialize it, we can use `init()`, `loadItems()` or `em.populate()`
  await em.populate(article, ['tags'])

  // remove 'old' tag by reference
  article.tags.remove(oldTag)

  // or via callback
  // article.tags.remove(t => t.id === oldTag.id);

  await em.flush()
}

{
  em.create(User, {
    fullName: 'Foo Bar',
    email: 'foo@bar.com',
    password: 'password123',
    articles: [
      {
        title: 'title 1/3',
        description: 'desc 1/3',
        text: 'text text text 1/3',
        tags: [
          { id: 1, name: 'foo1' },
          { id: 2, name: 'foo2' },
        ],
      },
      {
        title: 'title 2/3',
        description: 'desc 2/3',
        text: 'text text text 2/3',
        tags: [{ id: 2, name: 'foo2' }],
      },
      {
        title: 'title 3/3',
        description: 'desc 3/3',
        text: 'text text text 3/3',
        tags: [
          { id: 2, name: 'foo2' },
          { id: 3, name: 'foo3' },
        ],
      },
    ],
  })
  await em.flush()
}

// close the ORM, otherwise the process would keep going indefinitely
await orm.close()
