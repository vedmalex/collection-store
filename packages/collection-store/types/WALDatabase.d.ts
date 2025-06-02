import { CSDatabase } from './CSDatabase';
import { WALTransactionManager, WALTransactionOptions } from './WALTransactionManager';
import { Item } from './types/Item';
import { IDataCollection } from './IDataCollection';
import { IndexDef } from './types/IndexDef';
export interface WALDatabaseConfig {
    walOptions?: WALTransactionOptions;
    enableTransactions?: boolean;
    globalWAL?: boolean;
}
export declare class WALDatabase {
    private database;
    private walConfig;
    private globalWALManager?;
    private walCollections;
    constructor(root: string, name?: string, walConfig?: WALDatabaseConfig);
    private initializeGlobalWAL;
    createCollection<T extends Item>(name: string): Promise<IDataCollection<T>>;
    collection<T extends Item>(name: string): IDataCollection<T> | undefined;
    dropCollection(name: string): Promise<boolean>;
    beginGlobalTransaction(options?: WALTransactionOptions): Promise<string>;
    commitGlobalTransaction(transactionId: string): Promise<void>;
    rollbackGlobalTransaction(transactionId: string): Promise<void>;
    persist(): Promise<any>;
    performRecovery(): Promise<void>;
    createGlobalCheckpoint(): Promise<string[]>;
    getWALEntries(collectionName?: string, fromSequence?: number): Promise<any[]>;
    isTransactionsEnabled(): boolean;
    getWALConfig(): WALDatabaseConfig;
    getGlobalWALManager(): WALTransactionManager | undefined;
    listWALCollections(): string[];
    close(): Promise<void>;
    connect(): Promise<void>;
    load(): Promise<void>;
    listCollections(): Array<IDataCollection<any>>;
    createIndex(collection: string, name: string, def: IndexDef<any>): Promise<void>;
    dropIndex(collection: string, name: string): Promise<void>;
    private getRoot;
    private getName;
    getDatabase(): CSDatabase;
}
