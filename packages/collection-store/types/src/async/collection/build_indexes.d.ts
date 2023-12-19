import { IndexDef } from '../../types/IndexDef';
import { Item } from '../../types/Item';
import { Dictionary } from '../../types/Dictionary';
import Collection from '../collection';
export declare function build_indexes<T extends Item>(collection: Collection<T>, indexList: Dictionary<IndexDef<T>>): void;
