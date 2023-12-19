import { ArticleListing } from './modules/article/article-listing.entity'
import { Article } from './modules/article/article.entity'
import { Comment } from './modules/article/comment.entity'
import { User } from './modules/user/user.entity'
import { Tag } from './modules/article/tag.entity'
import { CollectionStoreDriver, defineConfig } from 'collection-store-mikro-orm'
import { SeedManager } from '@mikro-orm/seeder'

export default defineConfig({
  entities: [ArticleListing, Article, Comment, User, Tag],
  driver: CollectionStoreDriver,
  dbName: 'user-db',
  debug: true,
  extensions: [SeedManager],
})
