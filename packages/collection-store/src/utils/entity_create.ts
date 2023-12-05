import { Item } from '../types/Item'
import { ValueType } from 'b-pl-tree'
import { AnySchema } from 'ajv'
import { diff } from 'jsondiffpatch'
import { IStoredRecord } from '../types/IStoredRecord'
import { version_create } from './version_create'

export function entity_create<T extends Item>(
  id: ValueType,
  item: T,
  schema?: AnySchema,
): IStoredRecord<T> {
  return {
    id,
    version: 0,
    next_version: 1,
    data: item,
    created: Date.now(),
    updated: undefined,
    deleted: undefined,
    schema,
    history: [version_create(0, diff({}, item))],
  }
}
