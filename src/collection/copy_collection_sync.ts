import { Item } from '../Item'
import { build_index } from './build_index'
import { ensure_indexes } from './ensure_indexes'
import CollectionMemory from '../collection-memory'
import { build_index_sync } from './build_index_sync'

export function copy_collection_sync<T extends Item>(
  model: string,
  source: CollectionMemory<T>,
  dest?: CollectionMemory<T>,
): CollectionMemory<T> {
  const collection =
    dest ??
    CollectionMemory.create<T>({
      name: model,
      adapter: source.storage.clone(),
      list: source.list.construct(),
    })

  collection.indexDefs = source.indexDefs
  collection.id = source.id
  collection.ttl = source.ttl

  collection.inserts = []
  collection.removes = []
  collection.updates = []
  collection.ensures = []

  collection.indexes = {}
  build_index_sync(collection, collection.indexDefs)
  ensure_indexes(collection)
  for (const item of source.list.forward) {
    collection.push(item)
  }
  collection.persist()
  return collection
}
