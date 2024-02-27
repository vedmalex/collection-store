import { EntityRepository, type EntityName } from '@mikro-orm/core';
import type { CollectionStoreEntityManager } from './EntityManager';
import { Item } from 'collection-store';
export declare class CollectionStoreEntityRepository<T extends Item> extends EntityRepository<T> {
    protected readonly em: CollectionStoreEntityManager;
    constructor(em: CollectionStoreEntityManager, entityName: EntityName<T>);
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
    getCollection(): any;
    getEntityManager(): CollectionStoreEntityManager;
}
