import { Item } from '../types/Item';
export declare function get_value<T extends Item>(item: T, key: string, process?: (value: any) => any): T[string];
