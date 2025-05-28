import { get } from 'lodash-es'
import { Item } from '../types/Item'
import { Paths } from '../types/Paths'
import { IndexField } from '../types/IndexDef'

/**
 * Utilities for working with composite keys in indexes
 * Provides serialization, deserialization, and comparison functions
 * Updated to work with unified IndexDef structure
 */
export class CompositeKeyUtils {
  /**
   * Default separator for composite key serialization
   * Using null character to avoid conflicts with user data
   */
  static readonly DEFAULT_SEPARATOR = '\u0000'

  /**
   * Determines if an index definition represents a composite index
   * @param indexDef Index definition to check
   * @returns True if composite, false if single key
   */
  static isCompositeIndex<T extends Item>(indexDef: {
    key?: string | Paths<T>
    keys?: Array<string | Paths<T> | IndexField<T>>
  }): boolean {
    return !!(indexDef.keys && indexDef.keys.length > 1)
  }

  /**
   * Normalizes index definition to unified IndexField array
   * @param indexDef Index definition
   * @returns Array of normalized IndexField objects
   */
  static normalizeIndexFields<T extends Item>(indexDef: {
    key?: string | Paths<T>
    keys?: Array<string | Paths<T> | IndexField<T>>
    order?: 'asc' | 'desc'
  }): Array<IndexField<T>> {
    // Single key case
    if (indexDef.key && !indexDef.keys) {
      return [{
        key: indexDef.key,
        order: indexDef.order || 'asc'
      }]
    }

    // Multiple keys case
    if (indexDef.keys) {
      return indexDef.keys.map(keyDef => {
        if (typeof keyDef === 'string') {
          return { key: keyDef, order: 'asc' }
        } else if (typeof keyDef === 'object' && 'key' in keyDef) {
          return { key: keyDef.key, order: keyDef.order || 'asc' }
        } else {
          return { key: keyDef as Paths<T>, order: 'asc' }
        }
      })
    }

    throw new Error('Invalid index definition: must specify either key or keys')
  }

  /**
   * Generates index name from normalized fields or legacy string array
   * @param input Array of IndexField objects or legacy string array
   * @returns Generated index name
   */
  static generateIndexName(keyPaths: Array<string>): string
  static generateIndexName<T extends Item>(fields: Array<IndexField<T>>): string
  static generateIndexName<T extends Item>(
    input: Array<string> | Array<IndexField<T>>
  ): string {
    // Handle legacy string array format
    if (input.length > 0 && typeof input[0] === 'string') {
      return (input as string[]).join(',')
    }

    // Handle new IndexField array format
    const fields = input as Array<IndexField<T>>
    if (fields.length === 1) {
      // Single key: just the key name
      return String(fields[0].key)
    }

    // Composite key: include sort order information
    return fields.map(field => {
      const keyStr = String(field.key)
      return field.order === 'desc' ? `${keyStr}:desc` : keyStr
    }).join(',')
  }

  /**
   * Creates a process function for the index
   * @param fields Normalized index fields
   * @param separator Separator for composite keys
   * @returns Process function
   */
  static createProcessFunction<T extends Item>(
    fields: Array<IndexField<T>>,
    separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR
  ): ((item: T) => any) | undefined {
    if (fields.length === 0) {
      return undefined
    }

    if (fields.length === 1) {
      // Single key: extract and return the value
      const field = fields[0]
      return (item: T) => get(item, field.key as string)
    }

    // Composite key: extract values and serialize
    return (item: T) => {
      const values = fields.map(field => get(item, field.key as string))
      return CompositeKeyUtils.serialize(values, separator)
    }
  }

  /**
   * Creates a comparator function for B+ Tree
   * @param fields Normalized index fields
   * @param separator Separator for composite keys
   * @returns Comparator function or undefined for default comparison
   */
  static createComparator<T extends Item>(
    fields: Array<IndexField<T>>,
    separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR
  ): ((a: any, b: any) => number) | undefined {
    if (fields.length === 1) {
      const field = fields[0]
      if (field.order === 'desc') {
        return (a: any, b: any) => {
          if (a < b) return 1
          if (a > b) return -1
          return 0
        }
      }
      // For 'asc' or default, use natural comparison (return undefined)
      return undefined
    }

    // Composite key with mixed sort orders
    return (a: string, b: string): number => {
      const valuesA = CompositeKeyUtils.deserialize(a, separator)
      const valuesB = CompositeKeyUtils.deserialize(b, separator)

      for (let i = 0; i < Math.min(valuesA.length, valuesB.length, fields.length); i++) {
        const field = fields[i]
        const valueA = valuesA[i]
        const valueB = valuesB[i]

        // Handle null/undefined values
        if (valueA === null && valueB === null) continue
        if (valueA === null) return field.order === 'asc' ? -1 : 1
        if (valueB === null) return field.order === 'asc' ? 1 : -1

        // Compare values
        let comparison = 0
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          comparison = valueA.localeCompare(valueB)
        } else if (typeof valueA === 'number' && typeof valueB === 'number') {
          comparison = valueA - valueB
        } else if (valueA instanceof Date && valueB instanceof Date) {
          comparison = valueA.getTime() - valueB.getTime()
        } else {
          // Fallback to string comparison
          comparison = String(valueA).localeCompare(String(valueB))
        }

        if (comparison !== 0) {
          return field.order === 'desc' ? -comparison : comparison
        }
      }

      return 0
    }
  }

    /**
   * Serializes an array of values into a single string key
   * @param values Array of values to serialize
   * @param separator Separator character (default: null character)
   * @returns Serialized composite key as string
   */
  static serialize(values: any[], separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR): string {
    return values.map(value => {
      if (value === null || value === undefined) {
        return ''
      }
      // Convert to string and escape separator if it exists in the value
      const stringValue = String(value)
      // First escape backslashes, then escape the separator
      return stringValue
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `\\${separator}`)
    }).join(separator)
  }

  /**
   * Deserializes a composite key string back into array of values
   * @param serialized Serialized composite key string
   * @param separator Separator character used during serialization
   * @returns Array of deserialized values
   */
  static deserialize(serialized: string, separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR): any[] {
    if (!serialized) {
      return []
    }

    // More robust splitting that handles escaped separators
    const parts: string[] = []
    let current = ''
    let i = 0

    while (i < serialized.length) {
      if (serialized[i] === '\\' && i + 1 < serialized.length) {
        // Handle escaped character
        current += serialized[i + 1]
        i += 2
      } else if (serialized[i] === separator) {
        // Found unescaped separator
        parts.push(current === '' ? null : current)
        current = ''
        i++
      } else {
        current += serialized[i]
        i++
      }
    }

    // Add the last part
    parts.push(current === '' ? null : current)

    return parts
  }

  /**
   * Compares two composite key strings lexicographically
   * @param a First composite key
   * @param b Second composite key
   * @returns Comparison result (-1, 0, 1)
   */
  static compare(a: string, b: string): number {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }

  /**
   * Extracts values from an item using the specified key paths
   * @param item Item to extract values from
   * @param keyPaths Array of paths to extract
   * @returns Array of extracted values
   */
  static extractValues<T extends Item>(
    item: T,
    keyPaths: Array<string | Paths<T>>
  ): any[] {
    return keyPaths.map(path => {
      if (typeof path === 'string') {
        return get(item, path)
      }
      return get(item, path as string)
    })
  }

  /**
   * Creates a composite key from an item using specified paths
   * @param item Item to create key from
   * @param keyPaths Array of paths to use for the key
   * @param separator Separator character
   * @returns Serialized composite key
   */
  static createKey<T extends Item>(
    item: T,
    keyPaths: Array<string | Paths<T>>,
    separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR
  ): string {
    const values = CompositeKeyUtils.extractValues(item, keyPaths)
    return CompositeKeyUtils.serialize(values, separator)
  }

  /**
   * Validates that key paths are valid for composite key creation
   * @param keyPaths Array of paths to validate
   * @returns True if valid, false otherwise
   */
  static validateKeyPaths(keyPaths: Array<string | any>): boolean {
    if (!Array.isArray(keyPaths) || keyPaths.length === 0) {
      return false
    }

    return keyPaths.every(path =>
      typeof path === 'string' && path.length > 0
    )
  }

  /**
   * Generates a composite index name from key paths
   * @param keyPaths Array of paths
   * @returns Generated index name
   */
  static generateIndexNameLegacy(keyPaths: Array<string | any>): string {
    return keyPaths.map(path => String(path)).join(',')
  }

  /**
   * Checks if a value represents an empty composite key component
   * @param value Value to check
   * @returns True if empty, false otherwise
   */
  static isEmptyValue(value: any): boolean {
    return value === null || value === undefined || value === ''
  }

  /**
   * Creates a partial composite key for range queries
   * @param values Array of values (can be partial)
   * @param separator Separator character
   * @returns Partial composite key
   */
  static createPartialKey(
    values: any[],
    separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR
  ): string {
    // Filter out undefined values at the end for partial matching
    const filteredValues = []
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== undefined) {
        filteredValues.push(values[i])
      } else {
        break // Stop at first undefined to maintain order
      }
    }

    return CompositeKeyUtils.serialize(filteredValues, separator)
  }

}