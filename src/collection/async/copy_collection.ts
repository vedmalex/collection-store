import { Item } from '../../types/Item'
import { build_index } from './build_index'
import { ensure_indexes } from './ensure_indexes'
import Collection from '../../collection'

export async function copy_collection<T extends Item>(
  model: string,
  source: Collection<T>,
  dest?: Collection<T>,
): Promise<Collection<T>> {
  const collection =
    dest ??
    Collection.create<T>({
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
  build_index(collection, collection.indexDefs)
  await ensure_indexes(collection)
  for await (const item of source.list.forward) {
    await collection.push(item)
  }
  await collection.persist()
  return collection
}
