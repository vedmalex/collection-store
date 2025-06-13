import { ArticleListing } from './modules/article/article-listing.entity'
import { Article } from './modules/article/article.entity'
import { Comment } from './modules/article/comment.entity'
import { User } from './modules/user/user.entity'
import { Tag } from './modules/article/tag.entity'
import { SeedManager } from '@mikro-orm/seeder'

export default {
  entities: [ArticleListing, Article, Comment, User, Tag],
  dbName: 'user-db',
  debug: true,
  extensions: [SeedManager],
}
