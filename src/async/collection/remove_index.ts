import { Item } from '../../types/Item'
import Collection from '../Collection'

export function remove_index<T extends Item>(collection: Collection<T>, val) {
  collection.removes.forEach((item) => item(val))
}
