import { Paths } from '../../types/Paths';
import { Item } from '../../types/Item';
import Collection from '../collection';
import { ValueType } from 'b-pl-tree';
export declare function get_last_indexed_value<T extends Item>(collection: Collection<T>, key: Paths<T>, value: ValueType): Promise<T | undefined>;
