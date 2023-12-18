import { Paths } from 'src/types/Paths';
import { Item } from '../../types/Item';
import Collection from '../collection';
import { ValueType } from 'b-pl-tree';
export declare function get_first_indexed_value<T extends Item>(collection: Collection<T>, key: Paths<T>, value: ValueType): Promise<T | undefined>;
