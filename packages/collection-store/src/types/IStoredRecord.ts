import { Item } from './Item'
import { ValueType } from 'b-pl-tree'
import { IVersion } from './IVersion'
import { ZodType } from 'zod'

export interface IStoredRecord<T extends Item> {
  readonly id: ValueType
  readonly data: T
  readonly next_version: number
  readonly version: number
  readonly created: number
  readonly updated?: number
  readonly deleted?: number
  readonly schema?: ZodType<T>
  readonly history: Array<IVersion>
}
