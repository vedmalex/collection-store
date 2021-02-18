import { Item } from '../Item'
import Collection from '../collection'
import { query } from '../filter'
import { ValueType } from 'b-pl-tree'

// возможно не работает TTL не удаляются значения индекса.
export async function traverse<T extends Item>(
  collection: Collection<T>,
  condition: Partial<T> | ((T) => boolean),
  action: (index: ValueType, item: T) => void | boolean,
) {
  if (typeof condition == 'object') condition = query(condition)

  for (let i of collection.list) {
    let current = await collection.list.get(i)
    if (condition(current)) {
      // stop when action didn't return anything
      let next = action(i, current)
      if (!next) {
        break
      }
    }
  }
}

export function smart_traverse<T extends Item>(
  collection: Iterable<T>,
  condition: Partial<T> | ((T) => boolean),
  action: (item: T) => void | boolean,
) {
  if (typeof condition == 'object') condition = query(condition)

  for (let current of collection) {
    if (condition(current)) {
      // stop when action didn't return anything
      let next = action(current)
      if (!next) {
        break
      }
    }
  }
}
