import { ICollectionConfig } from './ICollectionConfig';
import { IDataCollection } from './IDataCollection';
import { Item } from './types/Item';
import { IndexDef } from './types/IndexDef';
export type TransactionOptions = {};
export interface CSTransaction {
    startTransaction(options: TransactionOptions): Promise<void>;
    abortTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    endSession(): Promise<void>;
}
export declare class CSDatabase implements CSTransaction {
    private root;
    private name;
    private inTransaction;
    private collections;
    constructor(root: string, name?: string);
    private writeSchema;
    connect(): Promise<void>;
    load(): Promise<void>;
    close(): Promise<void>;
    collectionList: Map<string, ICollectionConfig<any>>;
    private registerCollection;
    createCollection<T extends Item>(name: string): Promise<IDataCollection<T>>;
    listCollections(): Array<IDataCollection<any>>;
    dropCollection(name: string): Promise<boolean>;
    collection<T extends Item>(name: string): IDataCollection<T> | undefined;
    createIndex(collection: string, name: string, def: IndexDef<any>): Promise<void>;
    dropIndex(collection: string, name: string): Promise<void>;
    persist(): Promise<void[]>;
    startSession(): Promise<CSTransaction>;
    endSession(): Promise<void>;
    startTransaction(options: TransactionOptions): Promise<void>;
    abortTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
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
}
