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
}
