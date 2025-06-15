import { Item } from '../types/Item'
import { ValueType } from 'b-pl-tree'
import Collection from '../core/Collection'

export async function validate_indexed_value_for_update<T extends Item>(
  collection: Collection<T>,
  value: ValueType,
  key: string,
  sparse: boolean,
  required: boolean,
  unique: boolean,
  id: ValueType,
): Promise<[boolean, string?]> {
  if (!(sparse && value == null)) {
    if (required && value == null) {
      return [false, `value for index ${key} is required, but ${value} is met`]
    }
    if (
      unique &&
      collection.indexes.hasOwnProperty(key)
    ) {
      const existingPosition = collection.indexes[key].findFirst(value)
      if (existingPosition !== undefined) {
        // Get the item at that position to check if it's the same item we're updating
        const existingItem = await collection.list.get(existingPosition)
        if (existingItem && existingItem[collection.id] !== id) {
          return [false, `unique index ${key} already contains value ${value}`]
        }
      }
    }
  }
  return [true]
}
