import { Item } from '../../types/Item'
import { ValueType } from 'b-pl-tree'
import CollectionSync from '../collection'

export function validate_indexed_value_for_insert<T extends Item>(
  collection: CollectionSync<T>,
  value: ValueType,
  key: string,
  sparse: boolean,
  required: boolean,
  unique: boolean,
): [boolean, string?] {
  if (!(sparse && value == null)) {
    if (required && value == null) {
      return [false, `value for index ${key} is required, but ${value} is met`]
    }
    if (
      unique &&
      collection.indexes.hasOwnProperty(key) &&
      collection.indexes[key].findFirst(value)
    ) {
      return [false, `unique index ${key} already contains value ${value}`]
    }
  }
  return [true]
}
