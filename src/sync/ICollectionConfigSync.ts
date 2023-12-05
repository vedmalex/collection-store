import { IndexDef } from '../types/IndexDef'
import { Item } from '../types/Item'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import { IdType } from '../types/IdType'
import { IStorageAdapterSync } from './IStorageAdapterSync'
import { IListSync } from './IListSync'
import { AnySchema } from 'ajv'
export interface ICollectionConfigSync<T extends Item> {
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
  adapter: IStorageAdapterSync<T>
  root: string
}
