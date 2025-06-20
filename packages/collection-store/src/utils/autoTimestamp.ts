import { Item } from '../types/Item'
import { IList } from '../types/IList'

export function autoTimestamp<T extends Item>(
  item: T,
  model: string,
  list: IList<T>,
) {
  return Date.now()
}
