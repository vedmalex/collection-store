import { Item } from '../types/Item';
import Collection from '../collection';
import { ValueType } from 'b-pl-tree';
export declare function get_indexed_value<T extends Item>(collection: Collection<T>, key: string, value: ValueType): Promise<Array<T>>;
