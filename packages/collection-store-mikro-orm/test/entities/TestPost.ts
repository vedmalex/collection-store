import { Entity, PrimaryKey, Property, ManyToOne } from '../../src/index'

@Entity()
export class TestPost {
  @PrimaryKey({ type: 'number' })
  id!: number

  @Property({ type: 'string' })
  title!: string

  @Property({ type: 'string' })
  content!: string

  @ManyToOne('TestUser')
  author!: any

  @Property({ type: 'boolean', default: false })
  published: boolean = false

  @Property({ type: 'date', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ type: 'date', onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}