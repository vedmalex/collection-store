import { EntityRepository, EntityName } from '@mikro-orm/core';
import type { CollectionStoreEntityManager } from './EntityManager';
import { Item } from 'collection-store';
export declare class CollectionStoreEntityRepository<T extends Item> extends EntityRepository<T> {
    constructor(em: CollectionStoreEntityManager, entityName: EntityName<T>);
    getEntityManager(): CollectionStoreEntityManager;
    first(): Promise<T | undefined>;
    last(): Promise<T | undefined>;
    lowest(key: string): Promise<T | undefined>;
    greatest(key: string): Promise<T | undefined>;
    oldest(): Promise<T | undefined>;
    latest(): Promise<T | undefined>;
    findById(id: any): Promise<T | undefined>;
    findBy(key: string, id: any): Promise<T[]>;
    findFirstBy(key: string, id: any): Promise<T | undefined>;
    findLastBy(key: string, id: any): Promise<T | undefined>;
    getCollection(): import("collection-store").IDataCollection<T>;
}
