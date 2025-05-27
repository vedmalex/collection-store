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
  let value: ValueType

  // Check if this is a compound index by looking at the indexDef
  const indexDef = collection.indexDefs[key as string]
  const isCompoundIndex = !!(indexDef?.keys || indexDef?.composite)

  if (process && isCompoundIndex) {
    // For compound indexes, pass the entire item to process function
    value = process(item)
  } else {
    // For single key indexes, use lodash get
    value = get<T>(item as T, key as any) as unknown as ValueType
    if (value == null && auto) {
      value = gen?.(item, collection.name, collection.list) ?? value
      set(item, key as any, value)
    }
    // For single key indexes, apply process to the extracted value
    if (process && !isCompoundIndex) {
      value = process(value)
    }
  }

  return value
}
