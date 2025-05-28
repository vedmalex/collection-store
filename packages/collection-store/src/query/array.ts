import { ArrayOperator, QueryValue, QueryOperatorError } from './types'
import { compareBSONValues } from './comparison'
import type { UnaryCondition } from '../query/UnaryCondition'

// $all operator
export class AllOperator implements ArrayOperator {
  type = 'array' as const
  private values: QueryValue[]

  constructor(value: QueryValue) {
    if (!Array.isArray(value)) {
      throw new QueryOperatorError('$all requires an array', '$all', value)
    }
    this.values = value
  }

  evaluate(value: any): boolean {
    if (!Array.isArray(value)) {
      return (
        this.values.length === 1 &&
        compareBSONValues(value, this.values[0]) === 0
      )
    }

    return this.values.every((queryItem) =>
      value.some((fieldItem) => compareBSONValues(fieldItem, queryItem) === 0),
    )
  }
}

// $elemMatch operator
export class ElemMatchOperator implements ArrayOperator {
  type = 'array' as const
  private condition: UnaryCondition

  constructor(condition: UnaryCondition) {
    if (typeof condition !== 'function') {
      throw new QueryOperatorError(
        '$elemMatch requires a condition function',
        '$elemMatch',
        condition,
      )
    }
    this.condition = condition
  }

  evaluate(value: any): boolean {
    if (!Array.isArray(value)) {
      return false
    }
    return value.some((item) => this.condition(item))
  }
}

// $size operator
export class SizeOperator implements ArrayOperator {
  type = 'array' as const
  private expectedSize: number

  constructor(value: QueryValue) {
    if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
      throw new QueryOperatorError(
        '$size requires a non-negative integer',
        '$size',
        value,
      )
    }
    this.expectedSize = value
  }

  evaluate(value: any): boolean {
    if (!Array.isArray(value)) {
      return false
    }
    return value.length === this.expectedSize
  }
}

// Export a map of array operators
export const arrayOperators = {
  $all: AllOperator,
  $elemMatch: ElemMatchOperator,
  $size: SizeOperator,
} as const

// Type guard for array operators
export function isArrayOperator(value: any): value is ArrayOperator {
  return value && typeof value === 'object' && value.type === 'array'
}
