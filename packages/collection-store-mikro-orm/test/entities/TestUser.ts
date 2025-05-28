import { Entity, PrimaryKey, Property, Collection, OneToMany } from '../../src/index'

@Entity()
export class TestUser {
  @PrimaryKey({ type: 'number' })
  id!: number

  @Property({ type: 'string' })
  name!: string

  @Property({ type: 'string' })
  email!: string

  @Property({ type: 'number', nullable: true })
  age?: number

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true

  @OneToMany('TestPost', 'author')
  posts = new Collection<any>(this)

  @Property({ type: 'date', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ type: 'date', onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}