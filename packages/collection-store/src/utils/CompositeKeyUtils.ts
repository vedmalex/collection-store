import { get } from 'lodash-es'
import { Item } from '../types/Item'
import { Paths } from '../types/Paths'
import { CompositeKeyField } from '../types/IndexDef'

/**
 * Utilities for working with composite keys in indexes
 * Provides serialization, deserialization, and comparison functions
 */
export class CompositeKeyUtils {
  /**
   * Default separator for composite key serialization
   * Using null character to avoid conflicts with user data
   */
  static readonly DEFAULT_SEPARATOR = '\u0000'

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
  static generateIndexName(keyPaths: Array<string | any>): string {
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

  /**
   * Normalizes composite key definition to array of CompositeKeyField objects
   * @param keys Array of keys (can be strings, Paths, or CompositeKeyField objects)
   * @returns Array of normalized CompositeKeyField objects
   */
  static normalizeCompositeKeys<T extends Item>(
    keys: Array<string | Paths<T> | CompositeKeyField<T>>
  ): Array<CompositeKeyField<T>> {
    return keys.map(key => {
      if (typeof key === 'string') {
        return { key, order: 'asc' }
      } else if (typeof key === 'object' && 'key' in key) {
        return { key: key.key, order: key.order || 'asc' }
      } else {
        return { key: key as Paths<T>, order: 'asc' }
      }
    })
  }

  /**
   * Extracts values from an item using normalized composite key fields
   * @param item Item to extract values from
   * @param fields Array of normalized composite key fields
   * @returns Array of extracted values
   */
  static extractValuesWithOrder<T extends Item>(
    item: T,
    fields: Array<CompositeKeyField<T>>
  ): any[] {
    return fields.map(field => {
      const value = get(item, field.key as string)
      return value
    })
  }

  /**
   * Creates a comparator function for composite keys with mixed sort orders
   * @param fields Array of composite key fields with sort orders
   * @param separator Separator used for serialization
   * @returns Comparator function for B+ Tree
   */
  static createComparator<T extends Item>(
    fields: Array<CompositeKeyField<T>>,
    separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR
  ): (a: string, b: string) => number {
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
   * Creates a composite key with sort order consideration
   * @param item Item to create key from
   * @param fields Array of composite key fields with sort orders
   * @param separator Separator character
   * @returns Serialized composite key
   */
  static createKeyWithOrder<T extends Item>(
    item: T,
    fields: Array<CompositeKeyField<T>>,
    separator: string = CompositeKeyUtils.DEFAULT_SEPARATOR
  ): string {
    const values = CompositeKeyUtils.extractValuesWithOrder(item, fields)
    return CompositeKeyUtils.serialize(values, separator)
  }

  /**
   * Validates composite key fields configuration
   * @param fields Array of composite key fields to validate
   * @returns True if valid, false otherwise
   */
  static validateCompositeKeyFields<T extends Item>(
    fields: Array<CompositeKeyField<T>>
  ): boolean {
    if (!Array.isArray(fields) || fields.length === 0) {
      return false
    }

    return fields.every(field =>
      field &&
      typeof field === 'object' &&
      'key' in field &&
      (typeof field.key === 'string' && field.key.length > 0) &&
      (!field.order || field.order === 'asc' || field.order === 'desc')
    )
  }

  /**
   * Generates index name from composite key fields
   * @param fields Array of composite key fields
   * @returns Generated index name
   */
  static generateIndexNameFromFields<T extends Item>(
    fields: Array<CompositeKeyField<T>>
  ): string {
    return fields.map(field => {
      const keyStr = String(field.key)
      return field.order === 'desc' ? `${keyStr}:desc` : keyStr
    }).join(',')
  }
}