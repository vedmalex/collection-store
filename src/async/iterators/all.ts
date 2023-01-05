import { Item } from '../../types/Item'
import Collection from '../Collection'
import { query } from '../../query/query'
import { TraverseCondition } from '../../types/TraverseCondition'

// возможно не работает TTL не удаляются значения индекса.

export async function* all<T extends Item>(
  collection: Collection<T>,
  condition: TraverseCondition<T>,
): AsyncGenerator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for await (const current of collection.list.forward) {
    if (condition(current)) {
      yield current
    }
  }
}
