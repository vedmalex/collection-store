import { Item } from '../../types/Item'
import { sourceGte, sourceLte, ValueType } from 'b-pl-tree'
import CollectionSync, { ttl_key } from '../collection'

export function ensure_ttl_sync<T extends Item>(
  collection: CollectionSync<T>,
): void {
  if (collection.ttl) {
    // collection.indexes
    // ensure that all object are actuated with time
    const now = Date.now()
    // индекс по TTL
    const ttl_index = sourceLte<number, ValueType>(now - collection.ttl)(
      collection.indexes[ttl_key],
    )
    const source = [...ttl_index]
    for (const i of source) {
      // здесь проблема в том, что данные извлекаются по очереди
      collection.removeWithId(i.value)
    }
    collection.persist()
  }
}
