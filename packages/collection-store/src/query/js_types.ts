/**
 * Determines the JavaScript type of a value for query purposes.
 * @param value - The value to check.
 * @returns A string representing the type (e.g., 'null', 'undefined', 'boolean', 'number', 'string', 'date', 'regexp', 'array', 'buffer', 'object') or null if unknown.
 */
export function getJsType(value: unknown): string | null {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const jsType = typeof value

  if (jsType === 'string') return 'string'
  if (jsType === 'boolean') return 'boolean'
  if (jsType === 'number') return 'number'

  // Specific object types
  if (value instanceof Date) return 'date'
  if (value instanceof RegExp) return 'regexp'

  // Buffer check (important for Node.js environments)
  if (typeof Buffer !== 'undefined' && value instanceof Buffer) return 'buffer'

  if (Array.isArray(value)) return 'array'

  // Default for other objects
  if (jsType === 'object') return 'object'

  // BigInt and Symbol could be added if needed
  // if (jsType === 'bigint') return 'bigint';
  // if (jsType === 'symbol') return 'symbol';

  return null // Unknown type
}

// BSON_TYPE_ALIASES is removed.
