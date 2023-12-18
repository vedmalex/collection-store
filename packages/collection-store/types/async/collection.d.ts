import { IStorageAdapter } from './IStorageAdapter';
import { IList } from './IList';
import { IndexDef } from '../types/IndexDef';
import { IndexStored } from '../types/IndexStored';
import { Paths } from '../types/Paths';
import { Item } from '../types/Item';
import { IdGeneratorFunction } from '../types/IdGeneratorFunction';
import { ICollectionConfig, ISerializedCollectionConfig } from './ICollectionConfig';
import { CronJob } from 'cron';
import { Dictionary } from '../types/Dictionary';
import { BPlusTree, ValueType } from 'b-pl-tree';
import { TraverseCondition } from '../types/TraverseCondition';
import { StoredIList } from '../types/StoredIList';
import { IDataCollection } from './IDataCollection';
import { ProcessInsert } from './ProcessInsert';
import { ProcessUpdates } from './ProcessUpdates';
import { ProcessRemoves } from './ProcessRemoves';
import { ProcessEnsure } from './ProcessEnsure';
import { ProcessRebuild } from './ProcessRebuild';
import { ZodError, ZodType } from 'zod';
export declare const ttl_key = "__ttltime";
export default class Collection<T extends Item> implements IDataCollection<T> {
    get config(): ISerializedCollectionConfig;
    root: string;
    cronJob?: CronJob;
    createIndex(name: string, config: IndexDef<T>): void;
    listIndexes(): {
        key: {
            name: BPlusTree<any, any>;
        };
        name: string;
    }[];
    dropIndex(name: string): void;
    storage: IStorageAdapter<T>;
    ttl?: number;
    rotate?: string;
    name: string;
    id: string;
    auto?: boolean;
    audit: boolean;
    validation: ZodType<T>;
    validator(item: T): {
        success: true;
        data: T;
    } | {
        success: false;
        errors: ZodError<T>;
    };
    indexes: {
        [index: string]: BPlusTree<any, any>;
    };
    list: IList<T>;
    inserts: Array<ProcessInsert<T>>;
    updates: Array<ProcessUpdates<T>>;
    removes: Array<ProcessRemoves<T>>;
    ensures: Array<ProcessEnsure>;
    rebuilds: Array<ProcessRebuild>;
    indexDefs: Dictionary<IndexDef<T>>;
    genCache: Dictionary<IdGeneratorFunction<T>>;
    private constructor();
    static create<T extends Item>(config?: ICollectionConfig<T>): Collection<T>;
    static fromList<T extends Item>(array: Array<T>, id: string, root: string): Promise<Collection<T>>;
    reset(): Promise<void>;
    load(name?: string): Promise<void>;
    store(): {
        config: any;
        list: StoredIList;
        indexes: {
            [key: string]: unknown;
        };
        indexDefs: Dictionary<IndexStored<T>>;
    };
    persist(name?: string): Promise<void>;
    push(item: T): Promise<T | undefined>;
    create(item: T): Promise<T | undefined>;
    save(res: T): Promise<T | undefined>;
    first(): Promise<T>;
    last(): Promise<T>;
    lowest(key: Paths<T>): Promise<T | undefined>;
    greatest(key: Paths<T>): Promise<T | undefined>;
    oldest(): Promise<T | undefined>;
    latest(): Promise<T | undefined>;
    findById(id: ValueType): Promise<T | undefined>;
    findBy(key: Paths<T>, id: ValueType): Promise<Array<T>>;
    findFirstBy(key: Paths<T>, id: ValueType): Promise<T | undefined>;
    findLastBy(key: Paths<T>, id: ValueType): Promise<T | undefined>;
    find(condition: TraverseCondition<T>): Promise<Array<T>>;
    findFirst(condition: TraverseCondition<T>): Promise<T | undefined>;
    findLast(condition: TraverseCondition<T>): Promise<T | undefined>;
    update(condition: TraverseCondition<T>, update: Partial<T>, merge?: boolean): Promise<Array<T>>;
    updateFirst(condition: TraverseCondition<T>, update: Partial<T>, merge?: boolean): Promise<T | undefined>;
    updateLast(condition: TraverseCondition<T>, update: Partial<T>, merge?: boolean): Promise<T | undefined>;
    updateWithId(id: ValueType, update: Partial<T>, merge?: boolean): Promise<T | undefined>;
    removeWithId(id: ValueType): Promise<T | undefined>;
    remove(condition: TraverseCondition<T>): Promise<Array<T | undefined>>;
    removeFirst(condition: TraverseCondition<T>): Promise<T | undefined>;
    removeLast(condition: TraverseCondition<T>): Promise<T | undefined>;
}
