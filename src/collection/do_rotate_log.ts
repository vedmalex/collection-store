import { Item } from '../Item'
import Collection from '../collection'

export async function do_rotate_log<T extends Item>(source: Collection<T>) {
  if (source.list.length > 0) {
    let collection = await source.clone()
    collection.persist(`${source.model}${new Date().toUTCString()}`)
    source.reset()
    source.persist()
  }
}
