import { EntityRepository, type EntityName } from '@mikro-orm/core'
import type { CollectionStoreEntityManager } from './EntityManager'
import { Item } from 'collection-store'

export class CollectionStoreEntityRepository<
  T extends Item,
> extends EntityRepository<T> {
  constructor(
    protected override readonly em: CollectionStoreEntityManager,
    entityName: EntityName<T>,
  ) {
    super(em, entityName)
  }

  async first(entityName: EntityName<any>): Promise<any> {
    return this.getEntityManager().first(entityName)
  }
  async last(entityName: EntityName<any>): Promise<any> {
    return this.getEntityManager().last(entityName)
  }
  async lowest(entityName: EntityName<any>, key: string): Promise<any> {
    return this.getEntityManager().lowest(entityName, key)
  }
  async greatest(entityName: EntityName<any>, key: string): Promise<any> {
    return this.getEntityManager().greatest(entityName, key)
  }
  async oldest(entityName: EntityName<any>): Promise<any> {
    return this.getEntityManager().oldest(entityName)
  }
  async latest(entityName: EntityName<any>): Promise<any> {
    return this.getEntityManager().latest(entityName)
  }
  async findById(entityName: EntityName<any>, id: any) {
    return this.getEntityManager().findById(entityName, id)
  }
  async findBy(entityName: EntityName<any>, key: string, id: any) {
    return this.getEntityManager().findBy(entityName, key, id)
  }
  async findFirstBy(entityName: EntityName<any>, key: string, id: any) {
    return this.getEntityManager().findFirstBy(entityName, key, id)
  }
  async findLastBy(entityName: EntityName<any>, key: string, id: any) {
    return this.getEntityManager().findLastBy(entityName, key, id)
  }

  getCollection() {
    return this.getEntityManager().getCollection<T>(this.entityName)
  }

  /**
   * @inheritDoc
   */
  override getEntityManager(): CollectionStoreEntityManager {
    return this.em
  }
}
