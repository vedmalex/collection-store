import { Item } from './Item'
import { ValueType } from 'b-pl-tree'
import { AnySchema } from 'ajv'
import { IVersion } from './IVersion'

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
