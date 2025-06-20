import { Item } from '../types/Item'
import Collection from '../core/Collection'

export async function ensure_indexes<T extends Item>(
  collection: Collection<T>,
) {
  for (const ensure of collection.ensures) {
    ensure()
  }
}
