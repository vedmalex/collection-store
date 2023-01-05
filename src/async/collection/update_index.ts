import { Item } from '../../types/Item'
import Collection from '../Collection'
import { ValueType } from 'b-pl-tree'

export function update_index<T extends Item>(
  collection: Collection<T>,
  ov: T,
  nv: T,
  i: ValueType,
) {
  collection.updates.forEach((item) => item(ov, nv, i))
}
