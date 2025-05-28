import {
  EntityManager,
  type EntityName,
  type EntityRepository,
  type GetRepository,
  ForkOptions,
} from '@mikro-orm/core'
import type { CollectionStoreDriver } from './Driver'
import type { CollectionStoreEntityRepository } from './EntityRepository'
//@ts-ignore
import { Item } from 'collection-store'

/**
 * @inheritDoc
 */
export class CollectionStoreEntityManager<
  D extends CollectionStoreDriver = CollectionStoreDriver,
> extends EntityManager<D> {
  override fork(
    options?: ForkOptions | undefined,
  ): this {
    return super.fork(options) as this
  }
  async first(entityName: EntityName<any>): Promise<any> {
    return this.getDriver().first(entityName)
  }
  async last(entityName: EntityName<any>): Promise<any> {
    return this.getDriver().last(entityName)
  }
  async lowest(entityName: EntityName<any>, key: string): Promise<any> {
    return this.getDriver().lowest(entityName, key)
  }
  async greatest(entityName: EntityName<any>, key: string): Promise<any> {
    return this.getDriver().greatest(entityName, key)
  }
  async oldest(entityName: EntityName<any>): Promise<any> {
    return this.getDriver().oldest(entityName)
  }
  async latest(entityName: EntityName<any>): Promise<any> {
    return this.getDriver().latest(entityName)
  }
  async findById(entityName: EntityName<any>, id: any) {
    return this.getDriver().findById(entityName, id)
  }
  async findBy(entityName: EntityName<any>, key: string, id: any) {
    return this.getDriver().findBy(entityName, key, id)
  }
  async findFirstBy(entityName: EntityName<any>, key: string, id: any) {
    return this.getDriver().findFirstBy(entityName, key, id)
  }
  async findLastBy(entityName: EntityName<any>, key: string, id: any) {
    return this.getDriver().findLastBy(entityName, key, id)
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
