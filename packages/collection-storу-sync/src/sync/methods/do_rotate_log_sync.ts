import { Item } from '../../types/Item'
import CollectionSync from '../collection'
import { copy_collection_sync } from './copy_collection_sync'

export function do_rotate_log_sync<T extends Item>(source: CollectionSync<T>) {
  if (source.list.length > 0) {
    copy_collection_sync(`${source.model}.${new Date().toJSON()}`, source)

    source.reset()
    source.persist()
  }
}
