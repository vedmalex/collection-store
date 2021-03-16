import { IndexDef } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { StorageAdapter } from './interfaces/StorageAdapter'
import { IList } from './interfaces/IList'
import ajv, { SchemaObject } from 'ajv'
export interface CollectionConfig<T extends Item> {
  ttl?: string | number | boolean
  /** crontab format */
  rotate?: string
  list: IList<T>
  audit?: boolean
  validation?: SchemaObject
  defaults?: Partial<T>
  onRotate?: () => void
  name: string
  id?: string | Partial<IdType<T>>
  idGen?: string | IdGeneratorFunction<T>
  auto?: boolean
  indexList?: Array<IndexDef<T>>
  adapter: StorageAdapter<T>
  path?: string
}
