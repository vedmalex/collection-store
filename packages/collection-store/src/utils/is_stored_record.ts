import { IStoredRecord } from '../types/IStoredRecord'
import { Item } from '../types/Item'

export function is_stored_record<T extends Item>(item: T | IStoredRecord<T>): item is IStoredRecord<T> {
  return (
    Object.hasOwn(item, 'version') &&
    typeof item.version === 'number' &&
    Object.hasOwn(item, 'next_version') &&
    typeof item.next_version === 'number' &&
    Object.hasOwn(item, 'created') &&
    typeof item.created === 'number' &&
    Object.hasOwn(item, 'history') &&
    Array.isArray(item.history)
  )
}
