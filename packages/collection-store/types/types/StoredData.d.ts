import { StoredIList } from './StoredIList';
import { IndexStored } from '../types/IndexStored';
import { Item } from './Item';
import { Dictionary } from '../types/Dictionary';
import { PortableBPlusTree, ValueType } from 'b-pl-tree';
export interface StoredData<T extends Item> {
    list: StoredIList;
    indexes: Dictionary<PortableBPlusTree<any, ValueType>>;
    indexDefs: Dictionary<IndexStored<T>>;
    id: string;
    ttl?: number;
    rotate?: number;
}
