import { Item } from '../../types/Item';
import Collection from '../collection';
import { IdGeneratorFunction } from '../../types/IdGeneratorFunction';
import { ValueType } from 'b-pl-tree';
export declare function ensure_indexed_value<T extends Item>(item: T | Partial<T>, key: unknown, collection: Collection<T>, gen?: IdGeneratorFunction<T> | undefined, auto?: boolean, process?: (value: any) => any): ValueType;
