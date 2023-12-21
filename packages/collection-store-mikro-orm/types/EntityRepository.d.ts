import { EntityRepository, type EntityName } from '@mikro-orm/core';
import type { CollectionStoreEntityManager } from './EntityManager';
import { Item } from 'collection-store';
export declare class CollectionStoreEntityRepository<T extends Item> extends EntityRepository<T> {
    protected readonly em: CollectionStoreEntityManager;
    constructor(em: CollectionStoreEntityManager, entityName: EntityName<T>);
    getCollection(): import("collection-store").IDataCollection<T> | undefined;
    getEntityManager(): CollectionStoreEntityManager;
}
