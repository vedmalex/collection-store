import { Item } from '../../types/Item'
import { ensure_indexes } from './ensure_indexes'
import CollectionSync from '../collection'
import { build_index_sync } from './build_index_sync'

export function copy_collection_sync<T extends Item>(
  model: string,
  source: CollectionSync<T>,
  dest?: CollectionSync<T>,
): CollectionSync<T> {
  const collection =
    dest ??
    CollectionSync.create<T>({
      root: source.root,
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