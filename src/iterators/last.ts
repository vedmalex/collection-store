import { Item } from '../types/Item'
import Collection from '../collection'
import { query } from '../query/query'
import { TraverseCondition } from './TraverseCondition'

export async function* last<T extends Item>(
  collection: Collection<T>,
  condition: TraverseCondition<T>,
): AsyncGenerator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for await (const current of collection.list.backward) {
    if (condition(current)) {
      yield current
      return
    }
  }
}
