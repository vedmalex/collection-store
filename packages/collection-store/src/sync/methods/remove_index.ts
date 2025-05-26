import { Item } from '../../types/Item'
import CollectionSync from '../collection'

export function remove_index<T extends Item>(
  collection: CollectionSync<T>,
  val,
) {
  collection.removes.forEach((item) => item(val))
}
