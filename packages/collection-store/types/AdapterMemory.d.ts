import Collection from './collection';
import { Item } from './types/Item';
import { IStorageAdapter } from './IStorageAdapter';
export default class AdapterMemory<T extends Item> implements IStorageAdapter<T> {
    get name(): "AdapterMemory";
    collection: Collection<T>;
    clone(): AdapterMemory<T>;
    init(collection: Collection<T>): this;
    restore(name?: string): Promise<any>;
    store(name: string): Promise<void>;
}
