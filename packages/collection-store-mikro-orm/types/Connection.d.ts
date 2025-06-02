import { Configuration, Connection, ConnectionOptions, ConnectionType, EntityName, IsolationLevel, Transaction, TransactionEventBroadcaster } from '@mikro-orm/core';
import { CSDatabase, Item } from 'collection-store';
import type { CSTransaction } from 'collection-store';
import type { SavepointConnection } from './types';
export declare class CollectionStoreConnection extends Connection implements SavepointConnection {
    db: CSDatabase;
    constructor(config: Configuration, options?: ConnectionOptions, type?: ConnectionType);
    getDb(): CSDatabase;
    getCollection<T extends Item>(name: EntityName<T>): import("collection-store").IDataCollection<T>;
    private getCollectionName;
    connect(): Promise<void>;
    isConnected(): Promise<boolean>;
    checkConnection(): Promise<{
        ok: true;
    } | {
        ok: false;
        reason: string;
        error?: Error;
    }>;
    getDefaultClientUrl(): string;
    getClientUrl(): string;
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
    execute<T>(query: string, params?: any[] | undefined, method?: 'all' | 'get' | 'run' | undefined, ctx?: any): Promise<any>;
    close(force?: boolean): Promise<void>;
    ensureConnection(): Promise<void>;
    transactional<T>(cb: (trx: Transaction<CSTransaction>) => Promise<T>, options?: {
        isolationLevel?: IsolationLevel;
        ctx?: Transaction<CSTransaction>;
        eventBroadcaster?: TransactionEventBroadcaster;
    }): Promise<T>;
    begin(options?: {
        isolationLevel?: IsolationLevel;
        ctx?: Transaction<CSTransaction>;
        eventBroadcaster?: TransactionEventBroadcaster;
    }): Promise<CSTransaction>;
    commit(ctx: CSTransaction, eventBroadcaster?: TransactionEventBroadcaster): Promise<void>;
    rollback(ctx: CSTransaction, eventBroadcaster?: TransactionEventBroadcaster): Promise<void>;
    createSavepoint(ctx: CSTransaction, name: string): Promise<string>;
    rollbackToSavepoint(ctx: CSTransaction, savepointId: string): Promise<void>;
    releaseSavepoint(ctx: CSTransaction, savepointId: string): Promise<void>;
}
