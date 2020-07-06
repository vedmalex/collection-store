import { IndexDef } from './IndexDef';
import { Item } from './Item';
import { IdGeneratorFunction } from './IdGeneratorFunction';
import { IdType } from './IdType';
import { StorageAdapter } from './StorageAdapter';

export interface CollectionConfig<T extends Item> {
  ttl: string | number | boolean;
  rotate: string | number | boolean;
  name: string;
  id: string | Partial<IdType<T>>;
  idGen: string | IdGeneratorFunction<T>;
  auto: boolean;
  indexList: Array<IndexDef>;
  adapter: StorageAdapter<T>
}
