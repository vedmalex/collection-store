import { get, set } from 'lodash-es'
import { Item } from '../types/Item'
import Collection from '../core/Collection'
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

  // Check if this is a composite index by looking at the indexDef
  // const indexDef = collection.indexDefs[key as string]
  // const isCompositeIndex = !!(indexDef?.keys && indexDef.keys.length > 1)

  if (process) {
    // For both composite and single key indexes, pass the entire item to process function
    // The process function knows how to extract the correct value(s)
    value = process(item)
  } else {
    value = get(item, key as string)
  }

  if (value === undefined || value === null) {
    if (auto && gen) {
      value = gen(item as T, collection.name, collection.list)
      set(item, key as string, value)
    }
  }

  return value
}
