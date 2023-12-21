import { EntityRepository, type EntityName } from '@mikro-orm/core'
import type { CollectionStoreEntityManager } from './EntityManager'
import { Item } from 'collection-store'

export class MongoEntityRepository<T extends Item> extends EntityRepository<T> {
  constructor(
    protected override readonly em: CollectionStoreEntityManager,
    entityName: EntityName<T>,
  ) {
    super(em, entityName)
  }

  // /**
  //  * Shortcut to driver's aggregate method. Available in MongoDriver only.
  //  */
  // async aggregate(pipeline: any[]): Promise<any[]> {
  //   return this.getEntityManager().aggregate(this.entityName, pipeline)
  // }

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
