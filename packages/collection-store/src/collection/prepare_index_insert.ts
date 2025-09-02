import { Item } from '../types/Item'
import Collection from '../core/Collection'

/**
 * ensures values for indexing and return final index insert routines
 * @param collection source collection
 * @param val inserting value
 */
export function prepare_index_insert<T extends Item>(
  collection: Collection<T>,
  val: T,
) {
  const result: Array<any> = []
  // for is used to provide dynamic indexes add on create
  for (let i = 0; i < collection.inserts?.length; i += 1) {
    const inserts = collection.inserts[i](val)
    if (Array.isArray(inserts)) {
      result.push(...inserts)
    } else {
      result.push(inserts)
    }
  }

  return (i: any) => {
    result.forEach((f) => f?.(i))
  }
}
