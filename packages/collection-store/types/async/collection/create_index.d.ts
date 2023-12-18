import { IndexDef } from '../../types/IndexDef';
import { Item } from '../../types/Item';
import Collection from '../collection';
export declare function create_index<T extends Item>(collection: Collection<T>, key: string, indexDef: IndexDef<T>): void;
