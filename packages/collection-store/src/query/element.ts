import { ElementOperator, QueryValue, QueryOperatorError } from './types'

// $exists operator
export class ExistsOperator implements ElementOperator {
  type = 'element' as const
  private shouldExist: boolean

  constructor(value: QueryValue) {
    if (typeof value !== 'boolean') {
      throw new QueryOperatorError(
        '$exists requires a boolean value',
        '$exists',
        value,
      )
    }
    this.shouldExist = value
  }

  evaluate(value: any): boolean {
    return this.shouldExist ? value !== undefined : value === undefined
  }
}

// $type operator - Updated implementation based on query/$type.ts for BSON compatibility
export class TypeOperator implements ElementOperator {
  type = 'element' as const
  private checkers: ((v: unknown) => boolean)[]

  // Match BSON type names/aliases/numbers to JS checks
  // See: https://www.mongodb.com/docs/manual/reference/operator/query/type/#bson-types
  private static typeCheckers: Record<
    string | number,
    (v: unknown) => boolean
  > = {
    double: (v) => typeof v === 'number' && !Number.isInteger(v),
    1: (v) => typeof v === 'number' && !Number.isInteger(v),
    string: (v) => typeof v === 'string',
    2: (v) => typeof v === 'string',
    object: (v) =>
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v) &&
      !(v instanceof Date) &&
      !(v instanceof RegExp) &&
      !(v instanceof Uint8Array) &&
      !(typeof Buffer !== 'undefined' && v instanceof Buffer) &&
      (v as any)._bsontype !== 'ObjectId',
    3: (v) =>
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v) &&
      !(v instanceof Date) &&
      !(v instanceof RegExp) &&
      !(v instanceof Uint8Array) &&
      !(typeof Buffer !== 'undefined' && v instanceof Buffer) &&
      (v as any)._bsontype !== 'ObjectId',
    array: (v) => Array.isArray(v),
    4: (v) => Array.isArray(v),
    binData: (v) =>
      v instanceof Uint8Array ||
      (typeof Buffer !== 'undefined' && v instanceof Buffer),
    5: (v) =>
      v instanceof Uint8Array ||
      (typeof Buffer !== 'undefined' && v instanceof Buffer),
    undefined: (v) => v === undefined,
    6: (v) => v === undefined,
    objectId: (v) =>
      typeof v === 'object' &&
      v !== null &&
      (v as any)._bsontype === 'ObjectId',
    7: (v) =>
      typeof v === 'object' &&
      v !== null &&
      (v as any)._bsontype === 'ObjectId',
    bool: (v) => typeof v === 'boolean',
    boolean: (v) => typeof v === 'boolean', // Add support for 'boolean' alias
    8: (v) => typeof v === 'boolean',
    date: (v) => v instanceof Date,
    9: (v) => v instanceof Date,
    null: (v) => v === null,
    10: (v) => v === null,
    regex: (v) => v instanceof RegExp,
    11: (v) => v instanceof RegExp,
    int: (v) => typeof v === 'number' && Number.isInteger(v),
    16: (v) => typeof v === 'number' && Number.isInteger(v),
    long: (v) =>
      typeof v === 'bigint' || (typeof v === 'number' && Number.isInteger(v)),
    18: (v) =>
      typeof v === 'bigint' || (typeof v === 'number' && Number.isInteger(v)),
    number: (v) => typeof v === 'number' || typeof v === 'bigint',
  }

  constructor(value: QueryValue) {
    const typesToMatch = Array.isArray(value) ? value : [value]

    if (
      !typesToMatch.every((t) => typeof t === 'string' || typeof t === 'number')
    ) {
      throw new QueryOperatorError(
        '$type requires a BSON type string/number or an array of them',
        '$type',
        value,
      )
    }

    this.checkers = typesToMatch.map((t) => {
      const checker = TypeOperator.typeCheckers[t]
      if (!checker) {
        throw new QueryOperatorError(
          `Unsupported BSON type specified: ${t}`,
          '$type',
          t,
        )
      }
      return checker
    })

    if (this.checkers.length === 0) {
      throw new QueryOperatorError(
        'No valid BSON types provided',
        '$type',
        value,
      )
    }
  }

  evaluate(value: any, _context?: any): boolean {
    return this.checkers.some((checker) => checker(value))
  }
}

// Export a map of element operators
export const elementOperators = {
  $exists: ExistsOperator,
  $type: TypeOperator,
} as const

// Type guard for element operators
export function isElementOperator(value: any): value is ElementOperator {
  return value && typeof value === 'object' && value.type === 'element'
}
