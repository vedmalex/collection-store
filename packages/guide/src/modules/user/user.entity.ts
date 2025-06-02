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
import { createHash } from 'crypto'
import { BaseEntity } from '../common/base.entity.js'
import { Article } from '../article/article.entity.js'
import { UserRepository } from './user.repository.js'

@Embeddable()
export class Social {
  @Property({ type: 'string', nullable: true })
  twitter?: string

  @Property({ type: 'string', nullable: true })
  facebook?: string

  @Property({ type: 'string', nullable: true })
  linkedin?: string
}

@Entity({ repository: () => UserRepository })
export class User extends BaseEntity<'bio' | 'social'> {
  [EntityRepositoryType]?: UserRepository

  @Property({ type: 'string' })
  fullName: string

  @Property({ hidden: true, type: 'string' })
  email: string

  @Property({ hidden: true, lazy: true, type: 'string' })
  password: string

  @Property({ type: 'text' })
  bio = ''

  @OneToMany(() => Article, (article) => article.author, { hidden: true })
  articles = new Collection<Article>(this)

  @Property({ type: 'string', nullable: true })
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
      this.password = createHash('sha256').update(password).digest('hex')
    }
  }

  verifyPassword(password: string) {
    const pwd = createHash('sha256').update(password).digest('hex')
    return this.password === pwd
  }
}
