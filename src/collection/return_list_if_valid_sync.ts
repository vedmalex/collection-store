import { Item } from '../Item'
import { ensure_ttl_sync } from './ensure_ttl_sync'
import CollectionMemory from '../collection-memory'
import { is_valid_ttl } from './is_valid_ttl'

export function return_list_if_valid_sync<T extends Item>(
  collection: CollectionMemory<T>,
  items: Array<T>,
): Array<T> {
  let invalidate: boolean = false

  const result = items.filter((i) => {
    if (is_valid_ttl(collection, i)) {
      return true
    } else {
      invalidate = true
      return false
    }
  })

  if (invalidate) {
    if (collection.ttl && collection.list.length > 0) {
      ensure_ttl_sync(collection)
    }
  }
  return result
}
