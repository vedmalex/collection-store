import { IndexDef } from '../../types/IndexDef';
import { IndexStored } from 'src/types/IndexStored';
import { Item } from '../../types/Item';
import { Dictionary } from 'src/types/Dictionary';
import Collection from '../collection';
export declare function restore_index<T extends Item>(collection: Collection<T>, input: Dictionary<IndexStored<T>>): Dictionary<IndexDef<T>>;
