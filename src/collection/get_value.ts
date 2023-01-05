import { get } from 'lodash'
import { Item } from '../types/Item'

export function get_value<T extends Item>(
  item: T,
  key: string,
  process: (value: any) => any,
) {
  let value = get(item, key)
  if (process) {
    value = process(value)
  }
  return value
}
