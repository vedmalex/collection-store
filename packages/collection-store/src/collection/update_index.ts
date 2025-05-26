import { Item } from '../types/Item'
import Collection from '../collection'
import { ValueType } from 'b-pl-tree'

export async function update_index<T extends Item>(
  collection: Collection<T>,
  ov: T | Partial<T>,
  nv: T | Partial<T>,
  i: ValueType,
) {
  await Promise.all(collection.updates.map((item) => item(ov, nv, i)))
}
