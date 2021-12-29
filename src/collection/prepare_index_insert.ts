import { Item } from '../Item'
import Collection from '../collection'
import CollectionMemory from '../collection-memory'

/**
 * ensures values for indexing and return final index insert routines
 * @param collection source collection
 * @param val inserting value
 */
export function prepare_index_insert<T extends Item>(
  collection: Collection<T> | CollectionMemory<T>,
  val: T,
) {
  const result = []
  // for is used to provide dynamic indexes add on create
  for (let i = 0; i < collection.inserts?.length; i += 1) {
    result.push(collection.inserts[i](val))
  }

  return (i) => {
    result.forEach((f) => f?.(i))
  }
}
