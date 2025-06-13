import {
  Collection,
  Entity,
  ManyToMany,
  Property,
} from 'collection-store-mikro-orm'
import { Article } from './article.entity.js'
import { BaseEntity } from '../common/base.entity.js'

@Entity()
export class Tag extends BaseEntity {
  @Property({ length: 20, type: 'string' })
  name!: string

  @ManyToMany({ mappedBy: 'tags', entity: () => Article })
  articles = new Collection<Article>(this)
}
