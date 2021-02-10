import { Paths } from '../IndexDef'
import { Item } from '../Item'
import Collection from '../collection'
import { return_list_if_valid } from './return_list_if_valid'

export function get_indexed_value<T extends Item>(
  collection: Collection<T>,
  key: Paths<T>,
  value: any,
) {
  let result = []
  if (collection.indexes[key]) {
    result.push(
      ...collection.indexes[key].find(value).map((i) => collection.list.get(i)),
    )
  }
  return return_list_if_valid(collection, result)
}
