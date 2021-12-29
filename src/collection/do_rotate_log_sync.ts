import { Item } from '../Item'
import CollectionMemory from '../collection-memory'
import { copy_collection_sync } from './copy_collection_sync'

export function do_rotate_log_sync<T extends Item>(
  source: CollectionMemory<T>,
): CollectionMemory<T> {
  if (source.list.length > 0) {
    const collection = copy_collection_sync(
      `${source.model}${new Date().toUTCString()}`,
      source,
    )
    collection.persist()
    source.reset()
    source.persist()
    return collection
  }
}
