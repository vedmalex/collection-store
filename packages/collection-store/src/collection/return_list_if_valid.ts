import { Item } from '../types/Item'
import { ensure_ttl } from './ensure_ttl'
import Collection from '../core/Collection'
import { is_valid_ttl } from './is_valid_ttl'

export async function return_list_if_valid<T extends Item>(
  collection: Collection<T>,
  items: Array<T>,
): Promise<Array<T>> {
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
      await ensure_ttl(collection)
    }
  }
  return result
}
