import { Item } from '../../types/Item'
import { ValueType } from 'b-pl-tree'
import CollectionSync from '../collection'

export function update_index<T extends Item>(
  collection: CollectionSync<T>,
  ov: T,
  nv: T,
  i: ValueType,
) {
  collection.updates.forEach((item) => item(ov, nv, i))
}
