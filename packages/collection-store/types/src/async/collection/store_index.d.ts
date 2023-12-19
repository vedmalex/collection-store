import { IndexDef } from '../../types/IndexDef';
import { IndexStored } from '../../types/IndexStored';
import { Item } from '../../types/Item';
import { Dictionary } from '../../types/Dictionary';
import Collection from '../collection';
export declare function store_index<T extends Item>(collection: Collection<T>, input: Dictionary<IndexDef<T>>): Dictionary<IndexStored<T>>;
