import { Item } from '../types/Item';
import Collection from '../collection';
export declare function prepare_index_insert<T extends Item>(collection: Collection<T>, val: T): (i: any) => void;
