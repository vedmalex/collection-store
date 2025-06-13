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
  clientUrl: './data',
  entities: [Article, User, Tag],
  driver: CollectionStoreDriver,
  ensureDatabase: true,
  ensureIndexes: true,
  dbName: 'UserDb',
})

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
