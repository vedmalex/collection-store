import { Item } from '../../types/Item'
import CollectionMemory from '../collection-memory'

export function remove_index<T extends Item>(
  collection: CollectionMemory<T>,
  val,
) {
  collection.removes.forEach((item) => item(val))
}
