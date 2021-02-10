import { Item } from '../Item'
import Collection, { ttl_key } from '../collection'

export function is_valid_ttl<T extends Item>(
  collection: Collection<T>,
  item?: T,
) {
  if (item) {
    if (item[ttl_key]) {
      let now = Date.now()
      return now - item[ttl_key] <= collection.ttl
    } else {
      return true
    }
  } else {
    return false
  }
}
