import { Item } from './Item'
import { Paths } from './Paths'

export interface IndexStored<T extends Item> {
  key: string | Paths<T>
  // type?: ValueType
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  text?: boolean
  gen?: string
  process?: string
}
