import { Item } from '../types/Item'
import Collection from '../core/Collection'

export async function rebuild_indexes<T extends Item>(
  collection: Collection<T>,
) {
  for (const reduild of collection.rebuilds) {
    await reduild()
  }
}
