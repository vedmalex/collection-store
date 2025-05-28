import { EntityRepository, EntityName } from '@mikro-orm/core'
import type { CollectionStoreEntityManager } from './EntityManager'
//@ts-ignore
import { Item } from 'collection-store'

export class CollectionStoreEntityRepository<
  T extends Item,
> extends EntityRepository<T> {
  constructor(
    em: CollectionStoreEntityManager,
    entityName: EntityName<T>,
  ) {
    super(em, entityName)
  }

  /**
   * @inheritDoc
   */
  override getEntityManager(): CollectionStoreEntityManager {
    return this.em as CollectionStoreEntityManager
  }

  // Collection Store custom methods
  async first(): Promise<T | undefined> {
    return this.getEntityManager().first(this.entityName)
  }

  async last(): Promise<T | undefined> {
    return this.getEntityManager().last(this.entityName)
  }

  async lowest(key: string): Promise<T | undefined> {
    return this.getEntityManager().lowest(this.entityName, key)
  }

  async greatest(key: string): Promise<T | undefined> {
    return this.getEntityManager().greatest(this.entityName, key)
  }

  async oldest(): Promise<T | undefined> {
    return this.getEntityManager().oldest(this.entityName)
  }

  async latest(): Promise<T | undefined> {
    return this.getEntityManager().latest(this.entityName)
  }

  async findById(id: any): Promise<T | undefined> {
    return this.getEntityManager().findById(this.entityName, id)
  }

  async findBy(key: string, id: any): Promise<T[]> {
    return this.getEntityManager().findBy(this.entityName, key, id)
  }

  async findFirstBy(key: string, id: any): Promise<T | undefined> {
    return this.getEntityManager().findFirstBy(this.entityName, key, id)
  }

  async findLastBy(key: string, id: any): Promise<T | undefined> {
    return this.getEntityManager().findLastBy(this.entityName, key, id)
  }

  getCollection() {
    return this.getEntityManager().getCollection(this.entityName)
  }
}
