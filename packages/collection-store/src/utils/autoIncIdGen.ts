import { Item } from '../types/Item'
import { IList } from '../types/IList'

export function autoIncIdGen<T extends Item>(
  item: T,
  model: string,
  list: IList<T>,
) {
  return list.counter
}
