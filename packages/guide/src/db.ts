import {
  MikroORM,
  Options,
  EntityManager,
  EntityRepository,
  defineConfig,
} from 'collection-store-mikro-orm'
import { User } from './modules/user/user.entity.js'
import { Comment } from './modules/article/comment.entity.js'
import { Article } from './modules/article/article.entity.js'
import { Tag } from './modules/article/tag.entity.js'
import { ArticleListing } from './modules/article/article-listing.entity.js'
import { UserRepository } from './modules/user/user.repository.js'
import { ArticleRepository } from './modules/article/article.repository.js'

export interface Services {
  orm: MikroORM
  em: EntityManager
  comment: EntityRepository<Comment>
  tag: EntityRepository<Tag>
  user: UserRepository
  article: ArticleRepository
}

let cache: Services

export async function initORM(options?: Options): Promise<Services> {
  if (cache) {
    return cache
  }

  // allow overriding config options for testing
  const orm = await MikroORM.init(defineConfig({
    entities: [ArticleListing, Article, Comment, User, Tag],
    dbName: 'user-db',
    debug: true,
    ...options,
  }))

  // save to cache before returning
  return (cache = {
    orm,
    em: orm.em.fork() as EntityManager,
    article: orm.em.getRepository(Article) as ArticleRepository,
    comment: orm.em.getRepository(Comment),
    user: orm.em.getRepository(User) as UserRepository,
    tag: orm.em.getRepository(Tag),
  })
}
