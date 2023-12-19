import { Item } from '../../types/Item';
import Collection from '../collection';
export declare function return_one_if_valid<T extends Item>(collection: Collection<T>, result: T | undefined): Promise<T | undefined>;
