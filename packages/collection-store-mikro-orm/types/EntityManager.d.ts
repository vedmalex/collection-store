import { EntityManager, type EntityName, type EntityRepository, type GetRepository } from '@mikro-orm/core';
import type { CollectionStoreDriver } from './Driver';
import type { CollectionStoreEntityRepository } from './EntityRepository';
import { Item } from 'collection-store';
export declare class CollectionStoreEntityManager extends EntityManager<CollectionStoreDriver> {
    aggregate(entityName: EntityName<any>, pipeline: any[]): Promise<any[]>;
    first(entityName: EntityName<any>): Promise<any>;
    last(entityName: EntityName<any>): Promise<any>;
    lowest(entityName: EntityName<any>, key: string): Promise<any>;
    greatest(entityName: EntityName<any>, key: string): Promise<any>;
    oldest(entityName: EntityName<any>): Promise<any>;
    latest(entityName: EntityName<any>): Promise<any>;
    findById(entityName: EntityName<any>, id: any): Promise<any>;
    findBy(entityName: EntityName<any>, key: string, id: any): Promise<any[]>;
    findFirstBy(entityName: EntityName<any>, key: string, id: any): Promise<any>;
    findLastBy(entityName: EntityName<any>, key: string, id: any): Promise<any>;
    getCollection<T extends Item>(entityName: EntityName<T>): import("collection-store").IDataCollection<T> | undefined;
    getRepository<T extends object, U extends EntityRepository<T> = CollectionStoreEntityRepository<T>>(entityName: EntityName<T>): GetRepository<T, U>;
}
