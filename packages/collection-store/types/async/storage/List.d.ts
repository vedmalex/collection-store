import { ValueType } from 'b-pl-tree';
import { StoredIList } from '../../types/StoredIList';
import { Item } from '../../types/Item';
import { IList } from '../IList';
import Collection from '../collection';
export declare class List<T extends Item> implements IList<T> {
    get name(): "List";
    singlefile: boolean;
    hash: {
        [key: string]: T;
    };
    _counter: number;
    _count: number;
    collection: Collection<T>;
    exists: Promise<boolean>;
    init(collection: Collection<T>): IList<T>;
    clone(): Promise<IList<T>>;
    get(key: ValueType): Promise<T>;
    get counter(): number;
    get length(): number;
    set length(len: number);
    set(_key: ValueType, item: T): Promise<T>;
    update(_key: ValueType, item: T): Promise<T>;
    delete(i: ValueType): Promise<T>;
    reset(): Promise<void>;
    get keys(): string[];
    load(obj: StoredIList): IList<T>;
    construct(): List<T>;
    persist(): StoredIList;
    get forward(): AsyncIterable<T>;
    get backward(): AsyncIterable<T>;
    toArray(): AsyncGenerator<T, void, unknown>;
    toArrayReverse(): AsyncGenerator<T, void, unknown>;
}
