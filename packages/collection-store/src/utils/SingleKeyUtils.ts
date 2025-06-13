import { SortOrder } from '../types/IndexDef'

/**
 * Single Key utilities for handling sort order in single key indexes
 */
export class SingleKeyUtils {
  /**
   * Creates a comparator function for single keys with specified sort order
   * @param order - Sort order ('asc' or 'desc')
   * @returns Comparator function for BPlusTree
   */
  static createComparator(order: SortOrder = 'asc'): (a: any, b: any) => number {
    return (a: any, b: any): number => {
      // Handle null/undefined values
      if (a === null && b === null) return 0
      if (a === null) return order === 'asc' ? -1 : 1
      if (b === null) return order === 'asc' ? 1 : -1
      if (a === undefined && b === undefined) return 0
      if (a === undefined) return order === 'asc' ? -1 : 1
      if (b === undefined) return order === 'asc' ? 1 : -1

      // Handle different data types
      let result = 0

      if (typeof a === 'number' && typeof b === 'number') {
        result = a - b
      } else if (typeof a === 'string' && typeof b === 'string') {
        result = a.localeCompare(b)
      } else if (typeof a === 'boolean' && typeof b === 'boolean') {
        result = a === b ? 0 : (a ? 1 : -1)
      } else if (a instanceof Date && b instanceof Date) {
        result = a.getTime() - b.getTime()
      } else {
        // Fallback to string comparison
        result = String(a).localeCompare(String(b))
      }

      // Apply sort order
      const finalResult = order === 'desc' ? -result : result
      // Ensure we return 0 instead of -0
      return finalResult === 0 ? 0 : finalResult
    }
  }

  /**
   * Validates sort order value
   * @param order - Sort order to validate
   * @returns True if valid, false otherwise
   */
  static validateSortOrder(order: any): order is SortOrder {
    return order === 'asc' || order === 'desc'
  }

  /**
   * Normalizes sort order value with default
   * @param order - Sort order to normalize
   * @returns Normalized sort order ('asc' if invalid)
   */
  static normalizeSortOrder(order?: SortOrder): SortOrder {
    return this.validateSortOrder(order) ? order : 'asc'
  }
}