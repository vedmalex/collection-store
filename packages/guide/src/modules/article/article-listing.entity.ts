import { Entity, EntityManager, Property } from 'collection-store-mikro-orm'
import { Article } from './article.entity.js'

@Entity({
  expression: (em: EntityManager) => {
    return em.getRepository(Article).listArticlesQuery()
  },
})
export class ArticleListing {
  @Property({ type: String })
  slug!: string

  @Property({ type: String })
  title!: string

  @Property({ type: String })
  description!: string

  @Property({ type: Array })
  tags!: string[]

  @Property({ type: Number })
  author!: number

  @Property({ type: String })
  authorName!: string

  @Property({ type: Number })
  totalComments!: number
}
