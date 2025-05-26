import { get, set } from 'lodash-es'
import { Item } from '../types/Item'
import Collection from '../collection'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import { ValueType } from 'b-pl-tree'

export function ensure_indexed_value<T extends Item>(
  item: T | Partial<T>,
  key: unknown,
  collection: Collection<T>,
  gen?: IdGeneratorFunction<T> | undefined,
  auto?: boolean,
  process?: (value: any) => any,
): ValueType {
  let value = get<T>(item as T, key as any) as unknown as ValueType
  if (value == null && auto) {
    value = gen?.(item, collection.name, collection.list) ?? value
    set(item, key as any, value)
  }
  if (process) {
    value = process(value)
  }
  return value
}
