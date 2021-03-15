import { Item } from '../Item'
import Collection from '../collection'

export async function ensure_indexes<T extends Item>(
  collection: Collection<T>,
  rebuild: boolean,
) {
  for (const ensure of collection.ensures) {
    await ensure(rebuild)
  }
}
