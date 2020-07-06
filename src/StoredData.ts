import { StoredList } from './StoredList';
import { IndexDef } from './IndexDef';
import { Item } from './Item';

export interface StoredData<T extends Item> {
  list: StoredList<T>;
  indexes: { [index: string]: { [key: string]: number | Array<number>; }; };
  indexDefs: { [name: string]: IndexDef; };
  id: string;
  ttl?: number;
  rotate?: number;
}
