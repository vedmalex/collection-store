import { getJsType } from './js_types' // Will be created/renamed soon

// Simple JS type ordering (example)
const JS_TYPE_ORDER = {
  null: 0,
  undefined: 1, // Often considered distinct from null
  boolean: 2,
  number: 3,
  string: 4,
  date: 5, // Treat Date separately
  regexp: 6, // Treat RegExp separately
  array: 7,
  object: 8, // Includes generic objects, Buffer, etc.
  // Note: No specific BSON types like ObjectId, Long, etc.
}

/**
 * Determines the order rank of a JavaScript value based on its type.
 * Uses the JS_TYPE_ORDER map.
 * @param value - The value to determine the type order for.
 * @returns The numeric rank based on type, or a high number for unknown types.
 */
function getJsTypeOrder(value: unknown): number {
  const type = getJsType(value) // Uses the refactored type checker
  return type
    ? (JS_TYPE_ORDER[type as keyof typeof JS_TYPE_ORDER] ?? Infinity)
    : Infinity
}

/**
 * Compares two JavaScript values based primarily on type order, then value.
 * Returns:
 * - -1 if v1 < v2
 * - 0 if v1 === v2 (using deepCompare for objects/arrays)
 * - 1 if v1 > v2
 * - null if comparison is ambiguous or types are incompatible for value comparison.
 * @param v1 - First value.
 * @param v2 - Second value.
 */
export function compareValues(v1: unknown, v2: unknown): number | null {
  // --- ADDED: Explicit check for undefined ---
  // If either argument is undefined, they are incomparable for <, <=, >, >=
  if (v1 === undefined || v2 === undefined) {
    // Exception: if both are undefined, they are equal (0) handled by deepCompare later
    // Return null to indicate incomparability for ordering
    return null
  }
  // --- END ADDITION ---

  if (deepCompare(v1, v2)) {
    return 0 // Handles deep equality for objects, arrays, primitives
  }

  const typeOrder1 = getJsTypeOrder(v1)
  const typeOrder2 = getJsTypeOrder(v2)

  // If types are different, use type order
  if (typeOrder1 !== typeOrder2) {
    return typeOrder1 < typeOrder2 ? -1 : 1
  }

  // --- Same Type Comparison ---
  // Types are the same according to getJsTypeOrder, but deepCompare returned false.
  // Perform type-specific value comparison if applicable.

  // Use direct type checks for primitives where typeof works reliably
  if (typeof v1 === 'number' && typeof v2 === 'number') {
    return v1 < v2 ? -1 : 1
  }

  if (typeof v1 === 'string' && typeof v2 === 'string') {
    return v1 < v2 ? -1 : 1
  }

  if (typeof v1 === 'boolean' && typeof v2 === 'boolean') {
    // Standard boolean comparison: false < true
    return v1 === false && v2 === true ? -1 : 1
  }

  if (v1 instanceof Date && v2 instanceof Date) {
    const time1 = v1.getTime()
    const time2 = v2.getTime()
    return time1 < time2 ? -1 : 1
  }

  // For types like array, object, null, undefined, regex where value comparison
  // beyond equality doesn't make sense or is ambiguous in this context,
  // return null if deepCompare was false but type order is the same.
  // Exception: Arrays of same length containing comparable primitives?
  // For simplicity, if types match but deepCompare is false, consider them incomparable for >, <.
  if (typeOrder1 === JS_TYPE_ORDER.array) {
    // Optional: Add element-wise comparison for primitive arrays if needed.
    // Currently returns null as they are not deepEqual.
    return null
  }

  // Objects, null, undefined, regex are considered equal only if deepCompare is true.
  // If deepCompare is false, they are incomparable for sorting/ordering.
  return null
}

// --- Deep Comparison Utility --- (Keep existing deepCompare)

/**
 * Performs a deep comparison between two values.
 * Handles primitives, Dates, Arrays, and plain Objects.
 * Does not handle circular references.
 * @param v1 - First value.
 * @param v2 - Second value.
 * @returns True if the values are deeply equal, false otherwise.
 */
export function deepCompare(v1: unknown, v2: unknown): boolean {
  if (v1 === v2) {
    return true // Handles primitives (string, number, boolean, null, undefined, symbol, bigint)
  }

  // Handle Date objects
  if (v1 instanceof Date && v2 instanceof Date) {
    return v1.getTime() === v2.getTime()
  }

  // Handle Arrays
  if (Array.isArray(v1) && Array.isArray(v2)) {
    if (v1.length !== v2.length) {
      return false
    }
    for (let i = 0; i < v1.length; i++) {
      if (!deepCompare(v1[i], v2[i])) {
        return false
      }
    }
    return true
  }

  // Handle Objects (plain objects)
  if (
    typeof v1 === 'object' &&
    v1 !== null &&
    typeof v2 === 'object' &&
    v2 !== null &&
    !(v1 instanceof Date) && // Ensure they are not Dates (already handled)
    !(v2 instanceof Date) &&
    !Array.isArray(v1) && // Ensure they are not Arrays (already handled)
    !Array.isArray(v2) &&
    !(v1 instanceof RegExp) && // Don't deep compare RegExps by properties
    !(v2 instanceof RegExp) &&
    !(typeof Buffer !== 'undefined' && v1 instanceof Buffer) && // Treat Buffers as opaque objects for comparison by reference unless identical
    !(typeof Buffer !== 'undefined' && v2 instanceof Buffer)
  ) {
    const keys1 = Object.keys(v1 as object)
    const keys2 = Object.keys(v2 as object)

    if (keys1.length !== keys2.length) {
      return false
    }

    for (const key of keys1) {
      // Use Object.prototype.hasOwnProperty.call for safer key checking
      if (
        !Object.prototype.hasOwnProperty.call(v2, key) ||
        !deepCompare((v1 as any)[key], (v2 as any)[key])
      ) {
        return false
      }
    }
    return true
  }

  // Handle RegExp comparison (compare source and flags)
  if (v1 instanceof RegExp && v2 instanceof RegExp) {
    return v1.source === v2.source && v1.flags === v2.flags
  }

  // If none of the above, they are not deeply equal
  return false
}
