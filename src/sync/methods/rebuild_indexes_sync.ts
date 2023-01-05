import { Item } from '../../types/Item'
import CollectionMemory from '../CollectionMemory'

export function rebuild_indexes_sync<T extends Item>(
  collection: CollectionMemory<T>,
) {
  for (const reduild of collection.rebuilds) {
    reduild()
  }
}
