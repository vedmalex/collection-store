import { IndexDef } from '../../types/IndexDef';
import { IndexStored } from 'src/types/IndexStored';
import Collection from '../collection';
import { Item } from 'src';
export declare function restore_index_def<T extends Item>(collection: Collection<T>, input: IndexStored<T>): IndexDef<T>;
