import { ValueType, BPlusTree } from 'b-pl-tree';
import { StoredIList } from '../../types/StoredIList';
import { Item } from '../../types/Item';
import { IList } from '../IList';
import Collection from '../collection';
export declare class FileStorage<T extends Item> implements IList<T> {
    private keyField?;
    get name(): "FileStorage";
    singlefile: boolean;
    tree: BPlusTree<string, ValueType>;
    get folder(): string;
    constructor(keyField?: string | undefined);
    exists: Promise<boolean>;
    collection: Collection<T>;
    construct(): FileStorage<T>;
    init(collection: Collection<T>): IList<T>;
    clone(): Promise<IList<T>>;
    persist(): StoredIList;
    load(obj: StoredIList): IList<T>;
    get forward(): {
        [Symbol.asyncIterator]: () => AsyncGenerator<any, void, unknown>;
    };
    get backward(): {
        [Symbol.asyncIterator]: () => AsyncGenerator<any, void, unknown>;
    };
    toArray(): AsyncGenerator<any, void, unknown>;
    toArrayReverse(): AsyncGenerator<any, void, unknown>;
    private key_filename;
    private set_path;
    private get_path;
    reset(): Promise<void>;
    get(key: ValueType): Promise<T | undefined>;
    set(key: ValueType, item: T): Promise<T>;
    update(key: ValueType, item: T): Promise<T>;
    delete(key: ValueType): Promise<T>;
    _counter: number;
    get counter(): number;
    get length(): number;
}
