import { Item } from './types/Item';
import { IStorageAdapter } from './IStorageAdapter';
import Collection from './collection';
export default class AdapterFile<T extends Item> implements IStorageAdapter<T> {
    get name(): "AdapterFile";
    get file(): string;
    collection: Collection<T>;
    clone(): AdapterFile<T>;
    init(collection: Collection<T>): this;
    restore(name?: string): Promise<any>;
    store(name: string): Promise<void>;
}
