import { Item } from '../types/Item'
import { diff } from 'jsondiffpatch'
import { IStoredRecord } from '../types/IStoredRecord'
import { version_create } from './version_create'

import { debug } from 'debug'
const log = debug('entity_deleteÍ')

export function entity_delete<T extends Item>(
  record: IStoredRecord<T>,
): IStoredRecord<T> {
  log(arguments)
  const delta = diff({}, record.data)
  const v = version_create(record.next_version, delta!)
  record.history.push(v)
  return {
    ...record,
    data: {} as T,
    deleted: Date.now(),
    next_version: record.next_version + 1,
  }
}
