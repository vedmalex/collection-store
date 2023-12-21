import { Entity, ManyToOne, Property, Ref } from 'collection-store-mikro-orm'
import { Article } from './article.entity.js'
import { User } from '../user/user.entity.js'
import { BaseEntity } from '../common/base.entity.js'

@Entity()
export class Comment extends BaseEntity {
  @Property({ length: 1000 })
  text!: string

  @ManyToOne(() => Article)
  article!: Ref<Article>

  @ManyToOne(() => User)
  author!: Ref<User>
}
