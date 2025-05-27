import { get } from 'lodash-es'
import { Item } from '../types/Item'

export function get_value<T extends Item>(
  item: T,
  key: string,
  process?: (value: any) => any,
) {
  let value: any

  // For compound indexes, use the process function directly
  if (process) {
    value = process(item)
  } else {
    // For single key indexes, use lodash get
    value = get(item, key)
  }

  return value
}
