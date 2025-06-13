// import { hash, verify } from 'argon2';
import crypto from 'crypto'
import {
  BeforeCreate,
  BeforeUpdate,
  Collection,
  Entity,
  OneToMany,
  Property,
} from '@mikro-orm/core'
import { BaseEntity } from '../common/base.entity.js'
import { Article } from '../article/article.entity.js'

@Entity()
export class User extends BaseEntity<'bio'> {
  @Property()
  fullName: string

  @Property()
  email: string

  @Property({ hidden: true, lazy: true })
  password: string

  @Property({ type: 'text' })
  bio = ''

  @OneToMany({ mappedBy: 'author', entity: () => Article })
  articles = new Collection<Article>(this)

  constructor(fullName: string, email: string, password: string) {
    super()
    this.fullName = fullName
    this.email = email
    this.password = password // keep plain text, will be hashed via hooks
  }

  @BeforeCreate()
  @BeforeUpdate()
  async hashPassword(args: any) {
    // hash only if the password was changed
    const password = args.changeSet?.payload.password

    if (password) {
      this.password = await crypto.createHmac('sha256', password).digest('hex')
      // argon is not working inside stackblitz, so we use the old hashing here,
      // but awaiting it to show the same use case
      // this.password = await hash(password);
    }
  }

  async verifyPassword(password: string) {
    return this.password === crypto.createHmac('sha256', password).digest('hex')

    // argon is not working inside stackblitz, so we use the old hashing here,
    // but wrapped in async method to show the same use case
    // return verify(this.password, password);
  }
}
