import { IndexDef } from '../types/IndexDef'
import { Item } from '../types/Item'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import { IdType } from '../types/IdType'
import { IStorageAdapter } from './IStorageAdapter'
import { IList } from './IList'
import { AnySchema } from 'ajv'
export interface ICollectionConfig<T extends Item> {
  ttl?: string | number | boolean
  /** crontab format */
  rotate?: string
  list: IList<T>
  audit?: boolean
  validation?: AnySchema
  onRotate?: () => void
  name: string
  id?: string | Partial<IdType<T>>
  idGen?: string | IdGeneratorFunction<T>
  auto?: boolean
  indexList?: Array<IndexDef<T>>
  adapter: IStorageAdapter<T>
  root: string
}
