import { IndexDef, SerializedIndexDef } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { IStorageAdapter } from './IStorageAdapter'
import { IList } from './IList'
import { ZodType } from 'zod'

export interface ICollectionConfig<T extends Item> {
  root?: string
  name: string
  list?: IList<T>
  adapter?: IStorageAdapter<T>
  /** Database name - use ':memory:' for in-memory storage (like MikroORM) */
  dbName?: string
  ttl?: string | number
  /** crontab format */
  rotate?: string
  audit?: boolean
  validation?: ZodType<T>
  id?: string | Partial<IdType<T>>
  idGen?: string | IdGeneratorFunction<T>
  auto?: boolean
  indexList?: Array<IndexDef<T>>
}

export interface ISerializedCollectionConfig {
  name: string
  id: string
  ttl?: number
  /** crontab format */
  rotate?: string
  list: "single" | "List" | "separate" | "FileStorage" | 'chunked'
  audit?: boolean
  validation?: JSON
  auto?: boolean
  indexList: Array<SerializedIndexDef>
  adapter: 'AdapterMemory' | 'AdapterFile'
  root: string
  dbName?: string
}
