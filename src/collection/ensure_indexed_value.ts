import { get, set } from 'lodash'
import { Item } from '../types/Item'
import Collection from '../collection'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import CollectionMemory from 'src/collection-memory'

export function ensure_indexed_value<T extends Item>(
  item: T,
  key: string,
  collection: Collection<T> | CollectionMemory<T>,
  gen: IdGeneratorFunction<T>,
  auto: boolean,
  process: (value: any) => any,
) {
  let value = get(item, key)
  if (value == null && auto) {
    value = gen(item, collection.model, collection.list)
    set(item, key, value)
  }
  if (process) {
    value = process(value)
  }
  return value
}
