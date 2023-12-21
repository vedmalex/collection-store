import { EntityManager, type EntityName, type EntityRepository, type GetRepository } from '@mikro-orm/core';
import type { CollectionStoreDriver } from './Driver';
import type { CollectionStoreEntityRepository } from './EntityRepository';
import { Item } from 'collection-store';
export declare class CollectionStoreEntityManager extends EntityManager<CollectionStoreDriver> {
    aggregate(entityName: EntityName<any>, pipeline: any[]): Promise<any[]>;
    first(collection: string): Promise<any>;
    last(collection: string): Promise<any>;
    lowest(collection: string, key: string): Promise<any>;
    greatest(collection: string, key: string): Promise<any>;
    oldest(collection: string): Promise<any>;
    latest(collection: string): Promise<any>;
    findById(collection: string, id: any): Promise<void>;
    findBy(collection: string, key: string, id: any): Promise<void>;
    findFirstBy(collection: string, key: string, id: any): Promise<void>;
    findLastBy(collection: string, key: string, id: any): Promise<void>;
    getCollection<T extends Item>(entityName: EntityName<T>): import("collection-store").IDataCollection<T> | undefined;
    getRepository<T extends object, U extends EntityRepository<T> = CollectionStoreEntityRepository<T>>(entityName: EntityName<T>): GetRepository<T, U>;
}
