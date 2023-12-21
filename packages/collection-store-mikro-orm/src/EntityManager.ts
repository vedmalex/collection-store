import {
  EntityManager,
  Utils,
  type EntityName,
  type EntityRepository,
  type GetRepository,
} from '@mikro-orm/core'
import type { CollectionStoreDriver } from './Driver'
import type { MongoEntityRepository } from './EntityRepository'
import { Collection, Item } from 'collection-store'

/**
 * @inheritDoc
 */
export class CollectionStoreEntityManager extends EntityManager<CollectionStoreDriver> {
  /**
   * Shortcut to driver's aggregate method. Available in MongoDriver only.
   */
  async aggregate(
    entityName: EntityName<any>,
    pipeline: any[],
  ): Promise<any[]> {
    entityName = Utils.className(entityName)
    return this.getDriver().aggregate(entityName, pipeline)
  }

  async first(collection: string): Promise<any> {
    return this.getDriver().first(collection)
  }
  async last(collection: string): Promise<any> {
    return this.getDriver().last(collection)
  }

  async lowest(collection: string, key: string): Promise<any> {
    return this.getDriver().lowest(collection, key)
  }
  async greatest(collection: string, key: string): Promise<any> {
    return this.getDriver().greatest(collection, key)
  }

  async oldest(collection: string): Promise<any> {
    return this.getDriver().oldest(collection)
  }
  async latest(collection: string): Promise<any> {
    return this.getDriver().latest(collection)
  }
  async findById(collection: string, id: any) {
    return this.getDriver().findById(collection, id)
  }
  async findBy(collection: string, key: string, id: any) {
    return this.getDriver().findBy(collection, key, id)
  }
  async findFirstBy(collection: string, key: string, id: any) {
    return this.getDriver().findFirstBy(collection, key, id)
  }
  async findLastBy(collection: string, key: string, id: any) {
    return this.getDriver().findLastBy(collection, key, id)
  }

  getCollection<T extends Item>(entityName: EntityName<T>) {
    return this.getConnection().getCollection(entityName)
  }

  /**
   * @inheritDoc
   */
  override getRepository<
    T extends object,
    U extends EntityRepository<T> = MongoEntityRepository<T>,
  >(entityName: EntityName<T>): GetRepository<T, U> {
    return super.getRepository<T, U>(entityName)
  }
}
