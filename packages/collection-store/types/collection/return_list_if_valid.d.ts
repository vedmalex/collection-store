import { Item } from '../types/Item';
import Collection from '../collection';
export declare function return_list_if_valid<T extends Item>(collection: Collection<T>, items: Array<T>): Promise<Array<T>>;
