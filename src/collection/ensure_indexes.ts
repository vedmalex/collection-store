import { Item } from '../Item'
import Collection from '../collection'

export function ensure_indexes<T extends Item>(collection: Collection<T>) {
  collection.ensures.forEach((ensure) => ensure())
}
