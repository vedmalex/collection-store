import { Item } from '../types/Item'
import Collection from '../collection'
import CollectionMemory from '../collection-memory'

export async function ensure_indexes<T extends Item>(
  collection: Collection<T> | CollectionMemory<T>,
) {
  for (const ensure of collection.ensures) {
    ensure()
  }
}
