import {
  EntityManager,
  Utils,
  type EntityName,
  type EntityRepository,
  type GetRepository,
} from '@mikro-orm/core'
import type { CollectionStoreDriver } from './Driver'
import type { CollectionStoreEntityRepository } from './EntityRepository'
import { Item } from 'collection-store'

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

  async first(entityName: EntityName<any>): Promise<any> {
    const collection = Utils.className(entityName)
    return this.getDriver().first(collection)
  }
  async last(entityName: EntityName<any>): Promise<any> {
    const collection = Utils.className(entityName)
    return this.getDriver().last(collection)
  }
  async lowest(entityName: EntityName<any>, key: string): Promise<any> {
    const collection = Utils.className(entityName)
    return this.getDriver().lowest(collection, key)
  }
  async greatest(entityName: EntityName<any>, key: string): Promise<any> {
    const collection = Utils.className(entityName)
    return this.getDriver().greatest(collection, key)
  }
  async oldest(entityName: EntityName<any>): Promise<any> {
    const collection = Utils.className(entityName)
    return this.getDriver().oldest(collection)
  }
  async latest(entityName: EntityName<any>): Promise<any> {
    const collection = Utils.className(entityName)
    return this.getDriver().latest(collection)
  }
  async findById(entityName: EntityName<any>, id: any) {
    const collection = Utils.className(entityName)
    return this.getDriver().findById(collection, id)
  }
  async findBy(entityName: EntityName<any>, key: string, id: any) {
    const collection = Utils.className(entityName)
    return this.getDriver().findBy(collection, key, id)
  }
  async findFirstBy(entityName: EntityName<any>, key: string, id: any) {
    const collection = Utils.className(entityName)
    return this.getDriver().findFirstBy(collection, key, id)
  }
  async findLastBy(entityName: EntityName<any>, key: string, id: any) {
    const collection = Utils.className(entityName)
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
    U extends EntityRepository<T> = CollectionStoreEntityRepository<T>,
  >(entityName: EntityName<T>): GetRepository<T, U> {
    return super.getRepository<T, U>(entityName)
  }
}
