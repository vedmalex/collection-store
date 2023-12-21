import { Configuration, DatabaseDriver, EntityData, EntityDictionary, EntityName, FilterQuery, FindOptions, QueryResult } from '@mikro-orm/core';
import { CollectionStoreConnection } from './Connection';
import { CollectionStorePlatform } from './Platform';
import { Item } from 'collection-store';
export declare class CollectionStoreDriver extends DatabaseDriver<CollectionStoreConnection> {
    protected readonly platform: CollectionStorePlatform;
    protected readonly connection: CollectionStoreConnection;
    constructor(config: Configuration);
    find<T extends object>(entityName: string, where: FilterQuery<T>): Promise<EntityData<T>[]>;
    findOne<T extends object>(entityName: string, where: FilterQuery<T>): Promise<EntityData<T> | null>;
    connect(): Promise<CollectionStoreConnection>;
    nativeInsert<T extends Item>(entityName: string, data: EntityDictionary<T>): Promise<QueryResult<T>>;
    nativeInsertMany<T extends Item>(entityName: string, data: EntityDictionary<T>[]): Promise<QueryResult<T>>;
    nativeUpdate<T extends Item>(entityName: string, where: FilterQuery<T>, data: EntityDictionary<T>): Promise<QueryResult<T>>;
    nativeDelete<T extends Item>(entityName: string, where: FilterQuery<T>): Promise<QueryResult<T>>;
    count<T extends Item>(entityName: string, where: FilterQuery<T>): Promise<number>;
    findVirtual<T extends object>(entityName: string, where: FilterQuery<T>, options: FindOptions<T, any, any, any>): Promise<EntityData<T>[]>;
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
}
