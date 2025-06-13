import { Collection, Entity, ManyToMany, Property } from '@mikro-orm/core'
import { Article } from './article.entity.js'
import { BaseEntity } from '../common/base.entity.js'

@Entity()
export class Tag extends BaseEntity {
  @Property({ length: 20 })
  name!: string

  @ManyToMany({ mappedBy: 'tags', entity: () => Article })
  articles = new Collection<Article>(this)
}
