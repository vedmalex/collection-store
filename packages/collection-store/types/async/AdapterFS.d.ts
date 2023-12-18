import Collection from './collection';
import { Item } from '../types/Item';
import { IStorageAdapter } from './IStorageAdapter';
export default class AdapterFS<T extends Item> implements IStorageAdapter<T> {
    get name(): string;
    get file(): string;
    collection: Collection<T>;
    clone(): AdapterFS<T>;
    init(collection: Collection<T>): this;
    restore(name?: string): Promise<any>;
    store(name: string): Promise<void>;
}
