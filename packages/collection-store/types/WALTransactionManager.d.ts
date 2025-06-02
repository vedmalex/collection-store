import { TransactionManager, TransactionOptions, CollectionStoreTransaction } from './TransactionManager';
import { WALEntry } from './wal/WALTypes';
import { ITransactionalStorageAdapter } from './ITransactionalStorageAdapter';
import { Item } from './types/Item';
export interface WALTransactionOptions extends TransactionOptions {
    walPath?: string;
    enableWAL?: boolean;
    autoRecovery?: boolean;
}
export declare class WALTransactionManager extends TransactionManager {
    private walManager;
    private storageAdapters;
    private options;
    constructor(options?: WALTransactionOptions);
    beginTransaction(options?: TransactionOptions): Promise<string>;
    commitTransaction(transactionId: string): Promise<void>;
    rollbackTransaction(transactionId: string): Promise<void>;
    registerStorageAdapter<T extends Item>(adapter: ITransactionalStorageAdapter<T>): void;
    unregisterStorageAdapter<T extends Item>(adapter: ITransactionalStorageAdapter<T>): void;
    writeWALEntry(entry: Omit<WALEntry, 'sequenceNumber' | 'checksum'>): Promise<void>;
    performRecovery(): Promise<void>;
    createCheckpoint(): Promise<string>;
    getWALEntries(fromSequence?: number): Promise<WALEntry[]>;
    getCurrentWALSequence(): number;
    flushWAL(): Promise<void>;
    getTransaction(transactionId: string): CollectionStoreTransaction;
    getTransactionSafe(transactionId: string): CollectionStoreTransaction | undefined;
    cleanup(): Promise<void>;
    private getResourceName;
    get storageAdapterCount(): number;
    get isWALEnabled(): boolean;
    getActiveTransactionIds(): string[];
}
