import { Item } from '../../types/Item';
import Collection from '../collection';
import { ValueType } from 'b-pl-tree';
export declare function update_index<T extends Item>(collection: Collection<T>, ov: T | Partial<T>, nv: T | Partial<T>, i: ValueType): void;
