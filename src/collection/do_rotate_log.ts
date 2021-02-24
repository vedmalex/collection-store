import { Item } from '../Item'
import Collection from '../collection'
import { copy_collection } from './copy_collection'

export async function do_rotate_log<T extends Item>(
  source: Collection<T>,
): Promise<Collection<T>> {
  if (source.list.length > 0) {
    let collection = await copy_collection(
      source,
      `${source.model}${new Date().toUTCString()}`,
    )
    await collection.persist()
    await source.reset()
    await source.persist()
    return collection
  }
}
