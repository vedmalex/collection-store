import { ICollectionConfig } from './async/ICollectionConfig';
import { IDataCollection } from './async/IDataCollection';
import { Item } from './types/Item';
import { IndexDef } from './types/IndexDef';
export interface TransactionOptions {
}
export interface CSTransaction {
    startTransaction(options: TransactionOptions): Promise<void>;
    abortTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    endSession(): Promise<void>;
}
export declare class CSDatabase implements CSTransaction {
    private root;
    private inTransaction;
    private collections;
    constructor(root: string);
    private writeSchema;
    connect(): Promise<void>;
    load(): Promise<void>;
    close(): Promise<void>;
    collectionList: Map<string, ICollectionConfig<any>>;
    private registerCollection;
    createCollection<T extends Item>(name: string): IDataCollection<T>;
    listCollections(): Array<IDataCollection<any>>;
    dropCollection(name: string): boolean;
    collection<T extends Item>(name: string): IDataCollection<T> | undefined;
    createIndex(collection: string, name: string, def: IndexDef<any>): void;
    dropIndex(collection: string, name: string): void;
    persist(): Promise<void[]>;
    startSession(): Promise<CSTransaction>;
    endSession(): Promise<void>;
    startTransaction(options: TransactionOptions): Promise<void>;
    abortTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
}
