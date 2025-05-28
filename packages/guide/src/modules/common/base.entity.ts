import { OptionalProps, PrimaryKey, Property } from 'collection-store-mikro-orm'

export abstract class BaseEntity<Optional = never> {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | Optional

  @PrimaryKey({ type: 'number' })
  id!: number

  // @Property()
  // createdAt = new Date()

  // @Property({ onUpdate: () => new Date() })
  // updatedAt = new Date()
}
