import { Item } from '../../types/Item'
import Collection from '../collection'
import { ValueType } from 'b-pl-tree'

export function update_index<T extends Item>(
  collection: Collection<T>,
  ov: T | Partial<T>,
  nv: T | Partial<T>,
  i: ValueType,
) {
  collection.updates.forEach((item) => item(ov, nv, i))
}
