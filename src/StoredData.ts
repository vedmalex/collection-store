import { StoredList } from './StoredList';
import { IndexDef, IndexStored } from './IndexDef';
import { Item } from './Item';
import { Dictionary } from './hash';

export interface StoredData<T extends Item> {
  list: StoredList<T>;
  indexes: Dictionary<Dictionary<number | Array<number>>>;
  indexDefs: Dictionary<IndexStored>;
  id: string;
  ttl?: number;
  rotate?: number;
}
