import {
  BeforeCreate,
  BeforeUpdate,
  Collection,
  Embeddable,
  Embedded,
  Entity,
  EntityRepositoryType,
  type EventArgs,
  OneToMany,
  Property,
} from 'collection-store-mikro-orm'
import { BaseEntity } from '../common/base.entity.js'
import { Article } from '../article/article.entity.js'
import { UserRepository } from './user.repository.js'

@Embeddable()
export class Social {
  @Property()
  twitter?: string

  @Property()
  facebook?: string

  @Property()
  linkedin?: string
}

@Entity({ repository: () => UserRepository })
export class User extends BaseEntity<'bio' | 'social'> {
  [EntityRepositoryType]?: UserRepository

  @Property()
  fullName: string

  @Property({ hidden: true })
  email: string

  @Property({ hidden: true, lazy: true })
  password: string

  @Property({ type: 'text' })
  bio = ''

  @OneToMany(() => Article, (article) => article.author, { hidden: true })
  articles = new Collection<Article>(this)

  @Property({ persist: false })
  token?: string

  @Embedded(() => Social, { object: true })
  social?: Social

  constructor(fullName: string, email: string, password: string) {
    super()
    this.fullName = fullName
    this.email = email
    this.password = password
  }

  @BeforeCreate()
  @BeforeUpdate()
  hashPassword(args: EventArgs<User>) {
    // hash only if the value changed
    const password = args.changeSet?.payload.password

    if (password) {
      this.password = Bun.hash(password).toString()
    }
  }

  verifyPassword(password: string) {
    const pwd = Bun.hash(password).toString()
    return this.password === pwd
  }
}
