import { Item } from '../Item'
import Collection from '../collection'

// возможно не работает TTL не удаляются значения индекса.
export function traverse<T extends Item>(
  collection: Collection<T>,
  condition: Partial<T> | ((T) => boolean),
  action,
) {
  let condFunction = condition instanceof Function
  const count = condFunction ? 1 : Object.keys(condition).length

  for (let i of collection.list.keys) {
    let mc = 0
    let current = collection.list.get(i)
    if (condition instanceof Function) {
      let comp = condition(current)
      if (comp) {
        mc++
      }
    } else {
      for (let m in condition) {
        if (condition[m] == current[m]) {
          mc++
        } else {
          break
        }
      }
    }
    if (mc == count) {
      let next = action(i, current)
      if (!next) {
        break
      }
    }
  }
}
