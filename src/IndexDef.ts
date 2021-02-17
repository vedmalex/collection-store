import { IdGeneratorFunction } from './IdGeneratorFunction'
import { Item } from './Item'

export type Join<K, P> = K extends string | number
  ? P extends string
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never

export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]]

export type Paths<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? `${K}` | Join<K, Paths<T[K], Prev[D]>>
        : never
    }[keyof T]
  : ''

export type Leaves<T, D extends number = 1> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : ''

export interface IndexDef<T extends Item> {
  key: string | Paths<T>
  // type?: keyType
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: IdGeneratorFunction<T>
  process?: (value: any) => any
}

export type keyType =
  | 'number'
  | 'date'
  | 'string'
  | 'boolean'
  | 'bigint'
  | 'undefined'
export interface IndexStored<T extends Item> {
  key: string | Paths<T>
  // type?: keyType
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: string
  process?: string
}
