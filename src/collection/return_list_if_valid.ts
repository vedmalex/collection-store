import { Item } from '../Item'
import { ensure_ttl } from './ensure_ttl'
import Collection from '../collection'
import { is_valid_ttl } from './is_valid_ttl'

export function return_list_if_valid<T extends Item>(
  collection: Collection<T>,
  items?: Array<T>,
) {
  let invalidate = false

  let result = items.filter((i) => {
    if (is_valid_ttl(collection, i)) {
      return true
    } else {
      invalidate = true
      return false
    }
  })

  if (invalidate) {
    if (collection.ttl && collection.list.length > 0) {
      setImmediate(() => {
        ensure_ttl(collection)
      })
    }
  }
  return invalidate ? result : result
}