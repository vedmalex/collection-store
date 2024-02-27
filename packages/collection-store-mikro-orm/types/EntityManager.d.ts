import { EntityManager, type EntityName, type EntityRepository, type GetRepository, ForkOptions } from '@mikro-orm/core';
import type { CollectionStoreDriver } from './Driver';
import type { CollectionStoreEntityRepository } from './EntityRepository';
import { Item } from 'collection-store';
export declare class CollectionStoreEntityManager<D extends CollectionStoreDriver = CollectionStoreDriver> extends EntityManager<D> {
    fork(options?: ForkOptions | undefined): CollectionStoreEntityManager;
    first(entityName: EntityName<any>): Promise<any>;
    last(entityName: EntityName<any>): Promise<any>;
    lowest(entityName: EntityName<any>, key: string): Promise<any>;
    greatest(entityName: EntityName<any>, key: string): Promise<any>;
    oldest(entityName: EntityName<any>): Promise<any>;
    latest(entityName: EntityName<any>): Promise<any>;
    findById(entityName: EntityName<any>, id: any): Promise<any>;
    findBy(entityName: EntityName<any>, key: string, id: any): Promise<any>;
    findFirstBy(entityName: EntityName<any>, key: string, id: any): Promise<any>;
    findLastBy(entityName: EntityName<any>, key: string, id: any): Promise<any>;
    getCollection<T extends Item>(entityName: EntityName<T>): any;
    getRepository<T extends object, U extends EntityRepository<T> = CollectionStoreEntityRepository<T>>(entityName: EntityName<T>): GetRepository<T, U>;
}
