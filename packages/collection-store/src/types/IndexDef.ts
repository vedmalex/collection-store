import { IdGeneratorFunction } from './IdGeneratorFunction'
import { Item } from './Item'
import { Paths } from './Paths'

export type SortOrder = 'asc' | 'desc'

/**
 * Unified field definition for both single and composite keys
 * Supports sort order specification for each field
 */
export interface IndexField<T extends Item> {
  key: string | Paths<T>
  order?: SortOrder  // Default: 'asc'
}

/**
 * Unified Index Definition
 * Supports both single and composite keys with consistent API
 */
export interface IndexDef<T extends Item> {
  // === KEY DEFINITION (choose one) ===

  // Option 1: Single key (string or path)
  key?: string | Paths<T>

  // Option 2: Multiple keys (unified approach)
  keys?: Array<string | Paths<T> | IndexField<T>>

  // === INDEX CONFIGURATION ===

  // Sort order for single keys only (ignored for composite)
  order?: SortOrder

  // Composite key separator (default: '\u0000')
  separator?: string

  // Standard index options
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: IdGeneratorFunction<T>
  process?: (value: any) => any
}



/**
 * Serialized version for storage/transmission
 */
export interface SerializedIndexField {
  key: string
  order?: SortOrder
}

export interface SerializedIndexDef {
  key?: string
  keys?: Array<string | SerializedIndexField>
  order?: SortOrder
  separator?: string
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: string
  process?: string
}
