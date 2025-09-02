import { Item } from '../types/Item'
import { ValueType } from 'b-pl-tree'
import Collection from '../core/Collection'

export function validate_indexed_value_for_insert<T extends Item>(
  collection: Collection<T>,
  value: ValueType | ValueType[],
  key: string,
  sparse: boolean,
  required: boolean,
  unique: boolean,
): [boolean, string?] {
  const values = Array.isArray(value) ? value : [value]
  for (const v of values) {
    if (!(sparse && v == null)) {
      if (required && v == null) {
        return [false, `value for index ${key} is required, but ${v} is met`]
      }
      if (
        unique &&
        collection.indexes.hasOwnProperty(key) &&
        collection.indexes[key].findFirst(v) !== undefined
      ) {
        return [false, `unique index ${key} already contains value ${v}`]
      }
    }
  }
  return [true]
}
