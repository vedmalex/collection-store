import { QueryValue, QueryOperatorError, ComparisonOperator } from './types'

// --- BSON Comparison Utility --- BSON type comparison order

// Define an order for BSON types (simplified subset)
// Based on: https://docs.mongodb.com/manual/reference/bson-type-comparison-order/
// 1. Null
// 2. Numbers (int, long, double, decimal)
// 3. String
// 4. Object
// 5. Array
// 6. BinData (skipped)
// 7. ObjectId (skipped)
// 8. Boolean
// 9. Date
// 10. Timestamp (skipped)
// 11. Regex (skipped)
const BSON_TYPE_ORDER = {
  null: 1,
  number: 2, // Includes bigint approximation
  string: 3,
  object: 4, // Plain objects
  array: 5,
  boolean: 8,
  date: 9,
  // Add other types here if needed
}

function getBSONTypeOrder(value: unknown): number {
  if (value === null) return BSON_TYPE_ORDER.null
  const jsType = typeof value
  if (jsType === 'number' || jsType === 'bigint') return BSON_TYPE_ORDER.number
  if (jsType === 'string') return BSON_TYPE_ORDER.string
  if (jsType === 'boolean') return BSON_TYPE_ORDER.boolean
  if (value instanceof Date) return BSON_TYPE_ORDER.date
  if (Array.isArray(value)) return BSON_TYPE_ORDER.array
  if (jsType === 'object') return BSON_TYPE_ORDER.object
  // For unsupported types, assign a high order or handle specifically
  return Infinity // Or throw error?
}

/**
 * Compares two JavaScript values based on a simplified BSON comparison order.
 * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 * Returns null if values are incomparable (e.g., involving undefined).
 */
export function compareBSONValues(v1: unknown, v2: unknown): number | null {
  // 1. Handle undefined: Undefined is incomparable
  if (v1 === undefined || v2 === undefined) {
    // Exception: undefined === undefined (handled by deepCompare)
    if (v1 === undefined && v2 === undefined) return 0 // Or rely on deepCompare?
    // If one is undefined, they are incomparable for gt/lt/gte/lte purposes
    return null
  }

  // 2. Handle deep equality first (covers same values, types, Dates, and now Arrays)
  if (deepCompare(v1, v2)) {
    return 0
  }

  const typeOrder1 = getBSONTypeOrder(v1)
  const typeOrder2 = getBSONTypeOrder(v2)

  // 3. If types differ, compare based on type order
  if (typeOrder1 !== typeOrder2) {
    return typeOrder1 < typeOrder2 ? -1 : 1
  }

  // 4. If types are the same, perform type-specific comparison
  // Comparable types: number, string, date, boolean, array (element-wise)
  if (typeOrder1 === BSON_TYPE_ORDER.number) {
    try {
      const n1 = typeof v1 === 'bigint' ? v1 : BigInt(v1 as number)
      const n2 = typeof v2 === 'bigint' ? v2 : BigInt(v2 as number)
      return n1 < n2 ? -1 : n1 > n2 ? 1 : 0
    } catch {
      const n1 = v1 as number
      const n2 = v2 as number
      if (n1 < n2) return -1
      if (n1 > n2) return 1
      // Handle NaN comparison specifically? MongoDB treats NaN as equal to NaN.
      if (isNaN(n1) && isNaN(n2)) return 0
      if (isNaN(n1) || isNaN(n2)) return isNaN(n1) ? -1 : 1 // Or decide based on BSON spec
      return 0
    }
  }
  if (typeOrder1 === BSON_TYPE_ORDER.string) {
    return (v1 as string) < (v2 as string) ? -1 : 1 // Assumes > is covered by !< and !=0
  }
  if (typeOrder1 === BSON_TYPE_ORDER.date) {
    // deepCompare already handles dates, but we check again for explicit comparison
    const time1 = (v1 as Date).getTime()
    const time2 = (v2 as Date).getTime()
    return time1 < time2 ? -1 : time1 > time2 ? 1 : 0
  }
  if (typeOrder1 === BSON_TYPE_ORDER.boolean) {
    // false < true
    return (v1 as boolean) < (v2 as boolean)
      ? -1
      : (v1 as boolean) > (v2 as boolean)
        ? 1
        : 0
  }
  if (typeOrder1 === BSON_TYPE_ORDER.array) {
    // MongoDB array comparison: element by element until difference or end
    const arr1 = v1 as unknown[]
    const arr2 = v2 as unknown[]
    const len = Math.min(arr1.length, arr2.length)
    for (let i = 0; i < len; i++) {
      const comp = compareBSONValues(arr1[i], arr2[i])
      if (comp !== 0 && comp !== null) {
        // Ignore null results? Check Mongo spec
        return comp
      }
      // If comp is null (incomparable elements), what does Mongo do? Assume continues?
    }
    // If elements are equal so far, compare by length
    return arr1.length < arr2.length ? -1 : arr1.length > arr2.length ? 1 : 0
  }

  // For non-comparable types of the same order (object), consider them equal in terms of *ordering*
  // but deepCompare handles actual equality.
  return 0
}

// --- End BSON Comparison Utility ---

// Helper to check if two values are deeply equal (handles Dates)
// TODO: Consider moving this to a shared utility module if used elsewhere
// Should this also be exported if needed elsewhere? Or keep it local?
// Keeping it local for now as only compareBSONValues uses it directly here.
// Now exporting because compileQuery uses it directly.
export function deepCompare(val1: unknown, val2: unknown): boolean {
  if (val1 === val2) {
    return true
  }

  // Handle Date objects
  if (val1 instanceof Date && val2 instanceof Date) {
    return val1.getTime() === val2.getTime()
  }

  // Handle Arrays
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) {
      return false
    }
    for (let i = 0; i < val1.length; i++) {
      // Recursively compare elements
      if (!deepCompare(val1[i], val2[i])) {
        return false
      }
    }
    return true // Arrays are identical
  }

  // Handle simple Objects (optional, add if needed for query semantics)
  // if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null && !Array.isArray(val1) && !Array.isArray(val2) && !(val1 instanceof Date) && !(val2 instanceof Date)) {
  //     const keys1 = Object.keys(val1);
  //     const keys2 = Object.keys(val2);
  //     if (keys1.length !== keys2.length) {
  //         return false;
  //     }
  //     for (const key of keys1) {
  //         if (!Object.prototype.hasOwnProperty.call(val2, key) || !deepCompare((val1 as any)[key], (val2 as any)[key])) {
  //             return false;
  //         }
  //     }
  //     return true;
  // }

  // Add checks for other object types if needed (e.g., RegExp, ObjectId)
  // ...

  // For other types (including objects if not handled above), strict equality check (===) is usually sufficient
  return false // Default for non-equal, non-Date, non-Array types
}

// $eq operator
export class EqOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValue: QueryValue

  constructor(value: QueryValue) {
    // No specific validation needed for $eq value itself, it can be any type.
    this.queryValue = value
  }

  evaluate(value: any, _context?: any): boolean {
    // MongoDB's $eq behavior with undefined:
    // - { field: { $eq: undefined } } matches documents where field is undefined or missing.
    // - { field: { $eq: value } } (where value is not undefined) does NOT match documents where field is missing.
    if (this.queryValue === undefined) {
      // Matches if the field value is also undefined (or missing, which typeof checks as undefined)
      return value === undefined
    }
    // If field value is undefined, but query value is not, no match.
    if (value === undefined && this.queryValue !== undefined) {
      return false
    }
    // Perform deep comparison for Dates, strict for others.
    return deepCompare(value, this.queryValue)
  }
}

// $ne operator
export class NeOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValue: QueryValue

  constructor(value: QueryValue) {
    // No specific validation needed for $ne value itself.
    this.queryValue = value
  }

  evaluate(value: any, _context?: any): boolean {
    // $ne is essentially the negation of $eq, including handling of undefined/missing fields.
    // If query value is undefined, $ne matches fields that exist and are not undefined.
    if (this.queryValue === undefined) {
      return value !== undefined
    }
    // If field value is undefined (missing), $ne always matches (as it's not equal to a defined query value).
    if (value === undefined && this.queryValue !== undefined) {
      return true
    }
    // Otherwise, return the negation of the deep comparison.
    return !deepCompare(value, this.queryValue)
  }
}

// $gt operator
export class GtOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValue: QueryValue

  constructor(value: QueryValue) {
    // Basic validation: $gt usually requires a comparable value (string, number, Date).
    // Null/undefined query values usually result in no matches.
    // We don't throw an error here, but evaluate handles it.
    this.queryValue = value
  }

  evaluate(value: any, _context?: any): boolean {
    // Use BSON comparison: return true if value > queryValue
    return compareBSONValues(value, this.queryValue) === 1
  }
}

// $gte operator
export class GteOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValue: QueryValue

  constructor(value: QueryValue) {
    this.queryValue = value
  }

  evaluate(value: any, _context?: any): boolean {
    // Use BSON comparison: return true if value >= queryValue
    const comparison = compareBSONValues(value, this.queryValue)
    return comparison === 1 || comparison === 0
  }
}

// $lt operator
export class LtOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValue: QueryValue

  constructor(value: QueryValue) {
    this.queryValue = value
  }

  evaluate(value: any, _context?: any): boolean {
    // Use BSON comparison: return true if value < queryValue
    return compareBSONValues(value, this.queryValue) === -1
  }
}

// $lte operator
export class LteOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValue: QueryValue

  constructor(value: QueryValue) {
    this.queryValue = value
  }

  evaluate(value: any, _context?: any): boolean {
    // Use BSON comparison: return true if value <= queryValue
    const comparison = compareBSONValues(value, this.queryValue)
    return comparison === -1 || comparison === 0
  }
}

// $in operator
export class InOperator implements ComparisonOperator {
  type = 'comparison' as const
  // Store original values which might include RegExp
  private queryValues: QueryValue[]

  constructor(value: QueryValue) {
    if (!Array.isArray(value)) {
      throw new QueryOperatorError('$in requires an array', '$in', value)
    }
    // No deep validation of elements needed here, handled in evaluate
    this.queryValues = value
  }

  evaluate(value: any, _context?: any): boolean {
    // MongoDB $in matches if the field value equals any value in the query array.
    // If the field value is an array, check both:
    // 1. The array itself against query values
    // 2. Each element in the array against query values
    // Comparison uses BSON comparison order.
    // Also supports regular expressions in the query array.

    // Check if the value itself (including arrays) matches any query value
    const directMatch = this.queryValues.some((item) => {
      if (item instanceof RegExp) {
        // If query item is RegExp, test the field value (must be string)
        return typeof value === 'string' && item.test(value)
      }
      // Otherwise, use BSON comparison for equality check
      return compareBSONValues(value, item) === 0
    })

    if (directMatch) {
      return true
    }

    // If field value is an array, also check each element
    if (Array.isArray(value)) {
      return value.some((fieldItem) =>
        this.queryValues.some((queryItem) => {
          if (queryItem instanceof RegExp) {
            return typeof fieldItem === 'string' && queryItem.test(fieldItem)
          }
          return compareBSONValues(fieldItem, queryItem) === 0
        })
      )
    }

    return false
  }
}

// $nin operator
export class NinOperator implements ComparisonOperator {
  type = 'comparison' as const
  private queryValues: QueryValue[]

  constructor(value: QueryValue) {
    if (!Array.isArray(value)) {
      throw new QueryOperatorError('$nin requires an array', '$nin', value)
    }
    this.queryValues = value
  }

  evaluate(value: any, _context?: any): boolean {
    // $nin is the negation of $in.
    // It matches if the field value is not BSON-equal to any value in the query array
    // AND does not match any RegExp in the query array.

    // Check if the value itself (including arrays) matches any query value
    const directMatch = this.queryValues.some((item) => {
      if (item instanceof RegExp) {
        // If query item is RegExp, test the field value (must be string)
        return typeof value === 'string' && item.test(value)
      }
      // Otherwise, use BSON comparison for equality check
      return compareBSONValues(value, item) === 0
    })

    if (directMatch) {
      return false
    }

    // If field value is an array, also check each element
    if (Array.isArray(value)) {
      const foundMatch = value.some((fieldItem) =>
        this.queryValues.some((queryItem) => {
          if (queryItem instanceof RegExp) {
            return typeof fieldItem === 'string' && queryItem.test(fieldItem)
          }
          return compareBSONValues(fieldItem, queryItem) === 0
        })
      )
      return !foundMatch
    }

    return true
  }
}

// Export a map of comparison operators
export const comparisonOperators = {
  $eq: EqOperator,
  $ne: NeOperator,
  $gt: GtOperator,
  $gte: GteOperator,
  $lt: LtOperator,
  $lte: LteOperator,
  $in: InOperator,
  $nin: NinOperator,
  // ... other operators
} as const

// Type guard for comparison operators (optional, but can be useful)
export function isComparisonOperator(value: any): value is ComparisonOperator {
  return value && typeof value === 'object' && value.type === 'comparison'
}
