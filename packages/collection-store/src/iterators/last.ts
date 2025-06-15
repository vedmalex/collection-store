import { Item } from '../types/Item'
import Collection from '../core/Collection'
import { query } from '../query'
import { TraverseCondition } from '../types/TraverseCondition'

export async function* last<T extends Item>(
  collection: Collection<T>,
  condition: TraverseCondition<T>,
): AsyncGenerator<T> {
  const conditionFn = typeof condition === 'function' ? condition : query(condition)
  for await (const current of collection.list.backward) {
    if (conditionFn(current)) {
      yield current
      return
    }
  }
}
