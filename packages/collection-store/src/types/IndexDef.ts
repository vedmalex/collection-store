import { IdGeneratorFunction } from './IdGeneratorFunction'
import { Item } from './Item'
import { Paths } from './Paths'

export interface IndexDef<T extends Item> {
  key: string | Paths<T>
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: IdGeneratorFunction<T>
  process?: (value: any) => any
}

export interface SerializedIndexDef {
  key: string
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: string
  process?: string
}
