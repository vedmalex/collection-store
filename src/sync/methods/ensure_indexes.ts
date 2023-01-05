import { Item } from '../../types/Item'
import CollectionMemory from '../collection-memory'

export async function ensure_indexes<T extends Item>(
  collection: CollectionMemory<T>,
) {
  for (const ensure of collection.ensures) {
    ensure()
  }
}
