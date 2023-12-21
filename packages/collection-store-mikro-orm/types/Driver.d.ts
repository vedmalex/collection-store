import { Configuration, DatabaseDriver, EntityData, EntityDictionary, FilterQuery, FindOptions, QueryResult } from '@mikro-orm/core';
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
}
