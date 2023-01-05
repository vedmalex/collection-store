import { IndexDef } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { StorageAdapterSync } from './StorageAdapterSync'
import { IListSync } from './IListSync'
import { AnySchema } from 'ajv'
export interface CollectionConfigSync<T extends Item> {
  ttl?: string | number | boolean
  /** crontab format */
  rotate?: string
  list: IListSync<T>
  audit?: boolean
  validation?: AnySchema
  onRotate?: () => void
  name: string
  id?: string | Partial<IdType<T>>
  idGen?: string | IdGeneratorFunction<T>
  auto?: boolean
  indexList?: Array<IndexDef<T>>
  adapter: StorageAdapterSync<T>
  path?: string
}
