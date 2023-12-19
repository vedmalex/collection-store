import { Item } from '../../types/Item';
import { ValueType } from 'b-pl-tree';
import Collection from '../collection';
export declare function validate_indexed_value_for_update<T extends Item>(collection: Collection<T>, value: ValueType, key: string, sparse: boolean, required: boolean, unique: boolean, id: ValueType): [boolean, string?];
