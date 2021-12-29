import { Paths } from '../IndexDef'
import { Item } from '../Item'
import CollectionMemory from '../collection-memory'
import { return_list_if_valid_sync } from './return_list_if_valid_sync'
import { ValueType } from 'b-pl-tree'

export function get_indexed_value_sync<T extends Item>(
  collection: CollectionMemory<T>,
  key: Paths<T>,
  value: ValueType,
): Array<T> {
  const result: Array<T> = []
  if (collection.indexes[key]) {
    const keys = collection.indexes[key].find(value)
    for (const k of keys) {
      result.push(collection.list.get(k))
    }
  }
  return return_list_if_valid_sync(collection, result)
}
