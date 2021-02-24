import { Item } from '../Item'
import Collection from '../collection'

/**
 * ensures values for indexing and return final index insert routines
 * @param collection source collection
 * @param val inserting value
 */
export function prepare_index_insert<T extends Item>(
  collection: Collection<T>,
  val: T,
) {
  const result = collection.inserts.map((item) => item(val))
  return (i) => {
    result.forEach((f) => f(i))
  }
}
