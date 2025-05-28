import { BPlusTree } from 'b-pl-tree';
import { ITransactionResource } from './TransactionManager';
export interface IndexChange {
    type: 'insert' | 'remove';
    key: any;
    value?: any;
    timestamp: number;
}
export interface ITransactionAwareIndex extends ITransactionResource {
    insert_in_transaction(transactionId: string, key: any, value: any): Promise<void>;
    remove_in_transaction(transactionId: string, key: any, value?: any): Promise<void>;
    get_all_in_transaction(transactionId: string, key: any): Promise<any[]>;
    insert(key: any, value: any): void;
    remove(key: any): void;
    findFirst(key: any): any;
    findAll(key: any): any[];
    get min(): any;
    get max(): any;
}
export declare class IndexManager implements ITransactionAwareIndex {
    private btreeIndex;
    private transactionChanges;
    private transactionSnapshots;
    private preparedTransactions;
    constructor(btreeIndex: BPlusTree<any, any>);
    insert_in_transaction(transactionId: string, key: any, value: any): Promise<void>;
    remove_in_transaction(transactionId: string, key: any, value?: any): Promise<void>;
    get_all_in_transaction(transactionId: string, key: any): Promise<any[]>;
    insert(key: any, value: any): void;
    remove(key: any): void;
    findFirst(key: any): any;
    findAll(key: any): any[];
    get min(): any;
    get max(): any;
    prepareCommit(transactionId: string): Promise<boolean>;
    finalizeCommit(transactionId: string): Promise<void>;
    rollback(transactionId: string): Promise<void>;
    private ensureTransactionExists;
    private getTransactionSnapshot;
    private createSnapshot;
    private keysMatch;
    private canInsert;
    private canRemove;
    private cleanupTransaction;
    getActiveTransactionCount(): number;
    getTransactionChanges(transactionId: string): readonly IndexChange[];
    isPrepared(transactionId: string): boolean;
}
