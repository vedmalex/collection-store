import { Item } from '../types/Item'
import { ValueType } from 'b-pl-tree'
import { diff } from 'jsondiffpatch'
import { IStoredRecord } from '../types/IStoredRecord'
import { version_create } from './version_create'
import { ZodType } from 'zod'

import { debug } from 'debug'
const log = debug('entity_create')

export function entity_create<T extends Item>(
  id: ValueType,
  item: T,
  schema?: ZodType<T>,
): IStoredRecord<T> {
  log(arguments)
  return {
    id,
    version: 0,
    next_version: 1,
    data: item,
    created: Date.now(),
    updated: undefined,
    deleted: undefined,
    schema,
    history: [version_create(0, diff({}, item)!)],
  }
}
