import Collection from './collection';
import { IndexChange } from './IndexManager';
import { ITransactionResource } from './TransactionManager';
import { Item } from './types/Item';
import { ValueType } from 'b-pl-tree';
import { Paths } from './types/Paths';
import { IList } from './IList';
export interface CollectionChange {
    type: 'insert' | 'update' | 'remove';
    id: any;
    oldValue?: any;
    newValue?: any;
    timestamp: number;
}
export interface ITransactionalList<T extends Item> extends ITransactionResource {
    set_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined>;
    update_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined>;
    delete_in_transaction(transactionId: string, id: any): Promise<T | undefined>;
    get_in_transaction(transactionId: string, id: any): Promise<T | undefined>;
    get(id: any): Promise<T | undefined>;
    set(id: any, item: T): Promise<T | undefined>;
    update(id: any, item: T): Promise<T | undefined>;
    delete(id: any): Promise<T | undefined>;
}
export declare class TransactionalListWrapper<T extends Item> implements ITransactionalList<T> {
    private transactionChanges;
    private preparedTransactions;
    private list;
    private collection;
    constructor(list: IList<T>, collection?: Collection<T>);
    prepareCommit(transactionId: string): Promise<boolean>;
    finalizeCommit(transactionId: string): Promise<void>;
    rollback(transactionId: string): Promise<void>;
    private cleanupTransaction;
    set_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined>;
    update_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined>;
    delete_in_transaction(transactionId: string, id: any): Promise<T | undefined>;
    get_in_transaction(transactionId: string, id: any): Promise<T | undefined>;
    private ensureTransactionExists;
    get(id: any): Promise<T | undefined>;
    set(id: any, item: T): Promise<T | undefined>;
    update(id: any, item: T): Promise<T | undefined>;
    delete(id: any): Promise<T | undefined>;
    getTransactionChanges(transactionId: string): CollectionChange[];
}
export declare class TransactionalCollection<T extends Item> implements ITransactionResource {
    private indexManagers;
    private transactionalList;
    private collection;
    constructor(collection: Collection<T>);
    prepareCommit(transactionId: string): Promise<boolean>;
    finalizeCommit(transactionId: string): Promise<void>;
    rollback(transactionId: string): Promise<void>;
    create_in_transaction(transactionId: string, item: T): Promise<T | undefined>;
    update_in_transaction(transactionId: string, id: ValueType, update: Partial<T>, merge?: boolean): Promise<T | undefined>;
    remove_in_transaction(transactionId: string, id: ValueType): Promise<T | undefined>;
    findById_in_transaction(transactionId: string, id: ValueType): Promise<T | undefined>;
    findBy_in_transaction(transactionId: string, key: Paths<T>, value: ValueType): Promise<Array<T>>;
    private getIndexValue;
    get originalCollection(): Collection<T>;
    getTransactionChanges(transactionId: string): {
        list: CollectionChange[];
        indexes: {
            [indexName: string]: IndexChange[];
        };
    };
}
