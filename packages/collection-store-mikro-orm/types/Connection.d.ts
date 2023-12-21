import { Configuration, Connection, ConnectionOptions, ConnectionType, EntityName, IsolationLevel, Transaction, TransactionEventBroadcaster, TransactionOptions } from '@mikro-orm/core';
import { CSDatabase, Item } from 'collection-store';
import { CSTransaction } from 'collection-store/src/CSDatabase';
export declare class CollectionStoreConnection extends Connection {
    db: CSDatabase;
    constructor(config: Configuration, options?: ConnectionOptions, type?: ConnectionType);
    getDb(): CSDatabase;
    getCollection<T extends Item>(name: EntityName<T>): import("collection-store").IDataCollection<T> | undefined;
    private getCollectionName;
    connect(): Promise<void>;
    isConnected(): Promise<boolean>;
    checkConnection(): Promise<{
        ok: boolean;
        reason?: string | undefined;
        error?: Error | undefined;
    }>;
    getDefaultClientUrl(): string;
    getClientUrl(): string;
    first(collection: string): Promise<any>;
    last(collection: string): Promise<any>;
    lowest(collection: string, key: string): Promise<any>;
    greatest(collection: string, key: string): Promise<any>;
    oldest(collection: string): Promise<any>;
    latest(collection: string): Promise<any>;
    findById(collection: string, id: any): Promise<any>;
    findBy(collection: string, key: string, id: any): Promise<any[]>;
    findFirstBy(collection: string, key: string, id: any): Promise<any>;
    findLastBy(collection: string, key: string, id: any): Promise<any>;
    execute<T>(query: string, params?: any[] | undefined, method?: 'all' | 'get' | 'run' | undefined, ctx?: any): Promise<any>;
    close(force?: boolean): Promise<void>;
    ensureConnection(): Promise<void>;
    transactional<T>(cb: (trx: Transaction<CSTransaction>) => Promise<T>, options?: {
        isolationLevel?: IsolationLevel;
        ctx?: Transaction<CSTransaction>;
        eventBroadcaster?: TransactionEventBroadcaster;
    } & TransactionOptions): Promise<T>;
    begin(options?: {
        isolationLevel?: IsolationLevel;
        ctx?: Transaction<CSTransaction>;
        eventBroadcaster?: TransactionEventBroadcaster;
    } & TransactionOptions): Promise<CSTransaction>;
    commit(ctx: CSTransaction, eventBroadcaster?: TransactionEventBroadcaster): Promise<void>;
    rollback(ctx: CSTransaction, eventBroadcaster?: TransactionEventBroadcaster): Promise<void>;
}
