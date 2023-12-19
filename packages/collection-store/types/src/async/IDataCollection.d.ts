import { Paths } from '../types/Paths';
import { ValueType } from 'b-pl-tree';
import { TraverseCondition } from '../types/TraverseCondition';
import { IndexDef } from '../types/IndexDef';
import { Item } from '../types/Item';
import { ISerializedCollectionConfig } from './ICollectionConfig';
export interface IDataCollection<T extends Item> {
    get config(): ISerializedCollectionConfig;
    listIndexes(name: string): Array<{
        name: string;
        key: {
            [key: string]: any;
        };
    }>;
    dropIndex(name: string): any;
    createIndex(name: string, config: IndexDef<T>): void;
    ttl?: number;
    name: string;
    root: string;
    reset(): Promise<void>;
    load(name?: string): Promise<void>;
    persist(name?: string): Promise<void>;
    push(item: T): Promise<T | undefined>;
    create(item: T): Promise<T | undefined>;
    save(update: T): Promise<T | undefined>;
    first(): Promise<T | undefined>;
    last(): Promise<T | undefined>;
    oldest(): Promise<T | undefined>;
    latest(): Promise<T | undefined>;
    lowest(key: Paths<T>): Promise<T | undefined>;
    greatest(key: Paths<T>): Promise<T | undefined>;
    find(condition: TraverseCondition<T>): Promise<Array<T>>;
    findFirst(condition: TraverseCondition<T>): Promise<T | undefined>;
    findLast(condition: TraverseCondition<T>): Promise<T | undefined>;
    findBy(key: Paths<T>, id: ValueType): Promise<Array<T>>;
    findFirstBy(key: Paths<T>, id: ValueType): Promise<T | undefined>;
    findLastBy(key: Paths<T>, id: ValueType): Promise<T | undefined>;
    findById(id: ValueType): Promise<T | undefined>;
    update(condition: TraverseCondition<T>, update: Partial<T>): Promise<Array<T>>;
    updateFirst(condition: TraverseCondition<T>, update: Partial<T>): Promise<T | undefined>;
    updateLast(condition: TraverseCondition<T>, update: Partial<T>): Promise<T | undefined>;
    updateWithId(id: ValueType, update: Partial<T>): Promise<T | undefined>;
    removeWithId(id: ValueType): Promise<T | undefined>;
    remove(condition: TraverseCondition<T>): Promise<Array<T | undefined>>;
    removeFirst(condition: TraverseCondition<T>): Promise<T | undefined>;
    removeLast(condition: TraverseCondition<T>): Promise<T | undefined>;
}
