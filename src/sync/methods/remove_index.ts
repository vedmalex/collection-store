import { Item } from '../../types/Item'
import CollectionMemory from '../CollectionMemory'

export function remove_index<T extends Item>(
  collection: CollectionMemory<T>,
  val,
) {
  collection.removes.forEach((item) => item(val))
}
