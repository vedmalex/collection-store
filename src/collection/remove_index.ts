import { Item } from '../Item'
import Collection from '../collection'

export function remove_index<T extends Item>(
  collection: Collection<T>,
  val,
  i,
) {
  this.removes.forEach((item) => item(val, i))
}