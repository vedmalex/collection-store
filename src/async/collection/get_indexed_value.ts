import { Paths } from '../../types/Paths'
import { Item } from '../../types/Item'
import Collection from '../collection'
import { return_list_if_valid } from './return_list_if_valid'
import { ValueType } from 'b-pl-tree'

export async function get_indexed_value<T extends Item>(
  collection: Collection<T>,
  key: Paths<T>,
  value: ValueType,
): Promise<Array<T>> {
  const result: Array<T> = []
  if (collection.indexes[key]) {
    const keys = collection.indexes[key].find(value)
    for (const key of keys) {
      result.push(await collection.list.get(key))
    }
  }
  return return_list_if_valid(collection, result)
}
