import { Item } from '../Item'
import { ensure_ttl } from './ensure_ttl'
import Collection from '../collection'
import { is_valid_ttl } from './is_valid_ttl'

export async function return_one_if_valid<T extends Item>(
  collection: Collection<T>,
  result?: T,
) {
  if (result) {
    let invalidate = false

    if (result && !is_valid_ttl(collection, result)) {
      invalidate = true
    }
    if (invalidate) {
      if (collection.ttl && collection.list.length > 0) {
        await ensure_ttl(collection)
      }
    }
    return invalidate ? undefined : result
  } else {
    return result
  }
}
