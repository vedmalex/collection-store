import { Item } from '../types/Item'
import { diff } from 'jsondiffpatch'
import { IStoredRecord } from '../types/IStoredRecord'
import { version_create } from './version_create'

export function entity_update<T extends Item>(
  record: IStoredRecord<T>,
  item: T,
): IStoredRecord<T> {
  const delta = diff(record.data, item)
  const v = version_create(record.next_version, delta!)
  record.history.push(v)
  return {
    ...record,
    data: item,
    updated: Date.now(),
    next_version: record.next_version + 1,
  }
}
