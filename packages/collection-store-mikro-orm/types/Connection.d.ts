import { Configuration, Connection, ConnectionOptions, ConnectionType, IsolationLevel, Transaction, TransactionEventBroadcaster, TransactionOptions } from '@mikro-orm/core';
import { CSDatabase } from 'collection-store';
import { CSTransaction } from 'collection-store/src/CSDatabase';
export declare class CollectionStoreConnection extends Connection {
    db: CSDatabase;
    constructor(config: Configuration, options?: ConnectionOptions, type?: ConnectionType);
    getDb(): CSDatabase;
    connect(): void | Promise<void>;
    isConnected(): Promise<boolean>;
    checkConnection(): Promise<{
        ok: boolean;
        reason?: string | undefined;
        error?: Error | undefined;
    }>;
    getDefaultClientUrl(): string;
    getClientUrl(): string;
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
