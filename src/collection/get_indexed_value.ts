import { Paths } from '../IndexDef'
import { Item } from '../Item'
import Collection from '../collection'
import { return_list_if_valid } from './return_list_if_valid'

export async function get_indexed_value<T extends Item>(
  collection: Collection<T>,
  key: Paths<T>,
  value: any,
) {
  let result: Array<T> = []
  if (collection.indexes[key]) {
    const keys = collection.indexes[key].find(value)
    for (let key of keys) {
      result.push(await collection.list.get(key))
    }
  }
  return return_list_if_valid(collection, result)
}
