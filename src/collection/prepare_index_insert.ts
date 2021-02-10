import { Item } from '../Item'
import Collection from '../collection'

export function prepare_index_insert<T extends Item>(
  collection: Collection<T>,
  val,
) {
  let result = collection.inserts.map((item) => item(val))
  return (i) => {
    result.filter((f) => typeof f == 'function').forEach((f) => f(i))
  }
}
