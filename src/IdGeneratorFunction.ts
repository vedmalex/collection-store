import { List } from './List';
import { Item } from './Item';

export type IdGeneratorFunction<T extends Item> = (item: T, model: string, list: List<T>) => any;
