import { Item } from '../Item'
import { sourceGte, sourceLte, ValueType } from 'b-pl-tree'
import Collection, { ttl_key } from '../collection'

export async function ensure_ttl<T extends Item>(collection: Collection<T>) {
  if (collection.ttl) {
    // collection.indexes
    // ensure that all object are actuated with time
    let now = Date.now()
    // индекс по TTL
    let ttl_index = sourceGte<number, ValueType>(now - collection.ttl)(
      collection.indexes[ttl_key],
    )
    const source = [...ttl_index]
    for (let i of source) {
      // здесь проблема в том, что данные извлекаются по очереди
      await collection.removeWithId(i.value)
    }
    await collection.persist()
  }
}
