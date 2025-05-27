import { IdGeneratorFunction } from './IdGeneratorFunction'
import { Item } from './Item'
import { Paths } from './Paths'

export type SortOrder = 'asc' | 'desc'

export interface CompositeKeyField<T extends Item> {
  key: string | Paths<T>
  order?: SortOrder  // Default: 'asc'
}

export interface CompositeKeyDef<T extends Item> {
  keys: Array<string | Paths<T> | CompositeKeyField<T>>
  separator?: string
}

export interface IndexDef<T extends Item> {
  key?: string | Paths<T>           // For single keys (optional when using composite)
  keys?: Array<string | Paths<T>>   // For composite keys
  composite?: CompositeKeyDef<T>    // Alternative composite key syntax
  order?: SortOrder                 // Sort order for single keys (default: 'asc')
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: IdGeneratorFunction<T>
  process?: (value: any) => any
}

export interface SerializedCompositeKeyField {
  key: string
  order?: SortOrder
}

export interface SerializedIndexDef {
  key?: string                      // For single keys
  keys?: Array<string>              // For composite keys (legacy)
  composite?: {                     // For composite key configuration
    keys: Array<string | SerializedCompositeKeyField>
    separator?: string
  }
  order?: SortOrder                 // Sort order for single keys
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: string
  process?: string
}
