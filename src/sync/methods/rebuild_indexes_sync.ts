import { Item } from '../../types/Item'
import CollectionSync from '../collection'

export function rebuild_indexes_sync<T extends Item>(
  collection: CollectionSync<T>,
) {
  for (const reduild of collection.rebuilds) {
    reduild()
  }
}
