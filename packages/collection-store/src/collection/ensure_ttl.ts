import { Item } from '../types/Item'
import { ValueType } from 'b-pl-tree'
import Collection, { ttl_key } from '../collection'

export async function ensure_ttl<T extends Item>(collection: Collection<T>) {
  if (collection.ttl) {
    // collection.indexes
    // ensure that all object are actuated with time
    const now = Date.now()
    const cutoffTime = now - collection.ttl

    // Get TTL index
    const ttlIndex = collection.indexes[ttl_key]
    if (!ttlIndex) return

    // Find all items with TTL less than cutoff time using the lt() method
    const expiredItems: ValueType[] = []

    // Use the lt() method to get a generator for items with TTL < cutoffTime
    const expiredGenerator = ttlIndex.lt(cutoffTime)(ttlIndex)

    let cursor = expiredGenerator.next()
    while (!cursor.done && cursor.value) {
      if (cursor.value.value !== undefined) {
        expiredItems.push(cursor.value.value)
      }
      cursor = expiredGenerator.next()
    }

    // Remove expired items using removeWithId now that the index/list issue is fixed
    for (const itemId of expiredItems) {
      await collection.removeWithId(itemId)
    }

    if (expiredItems.length > 0) {
      await collection.persist()
    }
  }
}
