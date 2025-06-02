import { IStorageAdapter } from './IStorageAdapter';
import { ITransactionResource } from './TransactionManager';
import { StoredData } from './types/StoredData';
import { Item } from './types/Item';
import { WALEntry } from './wal/WALTypes';
export interface ITransactionalStorageAdapter<T extends Item> extends IStorageAdapter<T>, ITransactionResource {
    writeWALEntry(entry: WALEntry): Promise<void>;
    readWALEntries(fromSequence?: number): Promise<WALEntry[]>;
    store_in_transaction(transactionId: string, name?: string): Promise<void>;
    restore_in_transaction(transactionId: string, name?: string): Promise<StoredData<T>>;
    createCheckpoint(transactionId: string): Promise<string>;
    restoreFromCheckpoint(checkpointId: string): Promise<void>;
    isTransactional(): boolean;
}
