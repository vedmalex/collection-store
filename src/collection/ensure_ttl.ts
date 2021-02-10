import { Item } from '../Item'
import { sourceGte } from 'b-pl-tree'
import Collection, { ttl_key } from '../collection'

export function ensure_ttl<T extends Item>(collection: Collection<T>) {
  if (collection.ttl) {
    collection.indexes
    // ensure that all object are actuated with time
    let now = Date.now()
    // индекс по TTL
    let ttl_index = sourceGte(now - collection.ttl)(collection.indexes[ttl_key])
    for (let i of ttl_index) {
      collection.removeWithId(i.value)
    }
    collection.persist()
  }
}
