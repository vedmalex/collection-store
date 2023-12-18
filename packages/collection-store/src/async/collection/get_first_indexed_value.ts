import { Paths } from '../../types/Paths'
import { Item } from '../../types/Item'
import Collection from '../collection'
import { return_one_if_valid } from './return_one_if_valid'
import { ValueType } from 'b-pl-tree'

export async function get_first_indexed_value<T extends Item>(
  collection: Collection<T>,
  key: Paths<T>,
  value: ValueType,
): Promise<T | undefined> {
  if (collection.indexes[key]) {
    const id = collection.indexes[key].findFirst(value)
    const result: T | undefined =
      id != null ? await collection.list.get(id) : undefined
    return return_one_if_valid(collection, result)
  }
}
