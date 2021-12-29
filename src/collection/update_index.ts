import { Item } from '../Item'
import Collection from '../collection'
import { ValueType } from 'b-pl-tree'
import CollectionMemory from '../collection-memory'

export function update_index<T extends Item>(
  collection: Collection<T> | CollectionMemory<T>,
  ov: T,
  nv: T,
  i: ValueType,
) {
  collection.updates.forEach((item) => item(ov, nv, i))
}
