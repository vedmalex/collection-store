import { Item } from '../../types/Item';
import { IndexDef } from '../../types/IndexDef';
import { IndexStored } from '../../types/IndexStored';
import Collection from '../collection';
export declare function restore_index_def<T extends Item>(collection: Collection<T>, input: IndexStored<T>): IndexDef<T>;
