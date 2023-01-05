import { Item } from '../../types/Item'
import { ensure_ttl_sync } from './ensure_ttl_sync'
import CollectionMemory from '../collection-memory'
import { is_valid_ttl } from './is_valid_ttl'

export function return_one_if_valid_sync<T extends Item>(
  collection: CollectionMemory<T>,
  result: T,
): T {
  let invalidate = false

  if (result && !is_valid_ttl(collection, result)) {
    invalidate = true
  }
  if (invalidate) {
    if (collection.ttl && collection.list.length > 0) {
      ensure_ttl_sync(collection)
    }
  }
  return invalidate ? undefined : result
}
