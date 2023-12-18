import { IdGeneratorFunction } from './IdGeneratorFunction'
import { Item } from './Item'
import { Paths } from './Paths'

export interface IndexDef<T extends Item> {
  key: string | Paths<T>
  // type?: ValueType
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: IdGeneratorFunction<T>
  process?: (value: any) => any
}
