import { IndexDef } from '../../types/IndexDef';
import { IndexStored } from 'src/types/IndexStored';
import { Item } from '../../types/Item';
import Collection from '../collection';
export declare function store_index_def<T extends Item>(collection: Collection<T>, input: IndexDef<T>): IndexStored<T>;
