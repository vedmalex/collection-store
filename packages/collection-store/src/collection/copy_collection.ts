import { Item } from '../types/Item'
import { build_indexes } from './build_indexes'
import { ensure_indexes } from './ensure_indexes'
import Collection from '../core/Collection'

export async function copy_collection<T extends Item>(
  model: string,
  source: Collection<T>,
  dest?: Collection<T>,
): Promise<Collection<T>> {
  const collection =
    dest ??
    Collection.create<T>({
      root: source.root,
      name: model,
      adapter: source.storage.clone(),
      list: source.list.construct(),
      // id: source.id,
      // ttl: source.ttl,
    })

  collection.indexDefs = source.indexDefs
  collection.id = source.id
  collection.ttl = source.ttl

  collection.inserts = []
  collection.removes = []
  collection.updates = []
  collection.ensures = []

  collection.indexes = {}
  build_indexes(collection, collection.indexDefs)
  await ensure_indexes(collection)
  for await (const item of source.list.forward) {
    await collection.push(item)
  }
  await collection.persist()
  return collection
}
