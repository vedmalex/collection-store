import { IStoredRecord } from '../types/IStoredRecord'
import { Item } from '../types/Item'

export function is_stored_record<T extends Item>(item: T | IStoredRecord<T>): item is IStoredRecord<T> {
  if (!item || typeof item !== 'object') return false
  return (
    Object.prototype.hasOwnProperty.call(item, 'version') &&
    typeof (item as any).version === 'number' &&
    Object.prototype.hasOwnProperty.call(item, 'next_version') &&
    typeof (item as any).next_version === 'number' &&
    Object.prototype.hasOwnProperty.call(item, 'created') &&
    typeof (item as any).created === 'number' &&
    Object.prototype.hasOwnProperty.call(item, 'history') &&
    Array.isArray((item as any).history)
  )
}
