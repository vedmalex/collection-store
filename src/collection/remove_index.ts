import { Item } from '../types/Item'
import Collection from '../collection'
import CollectionMemory from '../collection-memory'

export function remove_index<T extends Item>(
  collection: Collection<T> | CollectionMemory<T>,
  val,
) {
  collection.removes.forEach((item) => item(val))
}
