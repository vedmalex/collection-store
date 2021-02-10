import { Item } from '../Item'
import Collection from '../collection'

export function update_index<T extends Item>(
  collection: Collection<T>,
  ov,
  nv,
  i,
) {
  this.updates.forEach((item) => item(ov, nv, i))
}