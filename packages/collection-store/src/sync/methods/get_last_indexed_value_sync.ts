import { Paths } from 'src/types/Paths'
import { Item } from '../../types/Item'
import CollectionSync from '../collection'
import { return_one_if_valid_sync } from './return_one_if_valid_sync'
import { ValueType } from 'b-pl-tree'

export function get_last_indexed_value_sync<T extends Item>(
  collection: CollectionSync<T>,
  key: Paths<T>,
  value: ValueType,
): T {
  if (collection.indexes[key]) {
    const id = collection.indexes[key].findLast(value)
    const result = id != null ? collection.list.get(id) : undefined
    return return_one_if_valid_sync(collection, result)
  }
}
