import { Item } from '../types/Item'
import { IStoredRecord } from '../types/IStoredRecord'

import { debug } from 'debug'
const log = debug('is_stored_record')

export function is_stored_record<T extends Item>(
  item: T | IStoredRecord<T>,
): item is IStoredRecord<T> {
  log(arguments)
  return (
    item &&
    item.hasOwnProperty('id') &&
    item.hasOwnProperty('version') &&
    typeof item.version == 'number' &&
    item.hasOwnProperty('next_version') &&
    typeof item.next_version == 'number' &&
    item.hasOwnProperty('created') &&
    typeof item.created == 'number' &&
    item.hasOwnProperty('history') &&
    Array.isArray(item.history)
  )
}
