import { Item } from '../../types/Item'
import CollectionSync from '../collection'

export async function ensure_indexes<T extends Item>(
  collection: CollectionSync<T>,
) {
  for (const ensure of collection.ensures) {
    ensure()
  }
}
