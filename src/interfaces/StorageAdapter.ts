import Collection from '../collection'
import { StoredData } from '../adapters/StoredData'
import { Item } from '../Item'
import { BPlusTree, ValueType, PortableBPlusTree } from 'b-pl-tree'
import { AnySchema } from 'ajv'
import { Delta, diff } from 'jsondiffpatch'

export interface StorageAdapter<T extends Item> {
  restore(name?: string): Promise<StoredData<T>>
  store(name?: string): Promise<void>
  init(collection: Collection<T>): StorageAdapter<T>
  clone(): StorageAdapter<T>
}

export interface IStoredRecord<T extends Item> {
  readonly id: ValueType
  readonly data: T
  readonly next_version: number
  readonly version: number
  readonly created: number
  readonly updated?: number
  readonly deleted?: number
  readonly schema?: AnySchema
  readonly history: Array<IVersion>
}

export function is_stored_record<T extends Item>(
  item: T | IStoredRecord<T>,
): item is IStoredRecord<T> {
  return (
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

export interface IVersion {
  readonly version: number
  readonly date: number
  readonly delta: Delta
}

function version_create(version: number, delta: Delta): IVersion {
  return {
    version,
    delta,
    date: Date.now(),
  }
}

export function entity_load<T extends Item>(
  entity: IStoredRecord<T>,
): IStoredRecord<T> {
  return {
    ...entity,
  }
}

export function entity_update<T extends Item>(
  record: IStoredRecord<T>,
  item: T,
): IStoredRecord<T> {
  const delta = diff(record.data, item)
  const v = version_create(record.next_version, delta)
  record.history.push(v)
  return {
    ...record,
    data: item,
    updated: Date.now(),
    next_version: record.next_version + 1,
  }
}

export function entity_delete<T extends Item>(
  record: IStoredRecord<T>,
): IStoredRecord<T> {
  const delta = diff({}, record.data)
  const v = version_create(record.next_version, delta)
  record.history.push(v)
  return {
    ...record,
    data: null,
    deleted: Date.now(),
    next_version: record.next_version + 1,
  }
}

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
