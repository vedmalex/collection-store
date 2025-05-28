import {
  LogicalOperator,
  QueryOperator,
  QueryValue,
  QueryOperatorError,
  isQueryOperator,
} from './types'

// $and operator
export class AndOperator implements LogicalOperator {
  type = 'logical' as const
  private conditions: QueryOperator[]

  constructor(conditions: QueryValue[]) {
    if (!Array.isArray(conditions)) {
      throw new QueryOperatorError(
        '$and requires an array of conditions',
        '$and',
        conditions,
      )
    }
    this.conditions = conditions.map((condition) => {
      if (!condition || typeof condition !== 'object') {
        throw new QueryOperatorError(
          'Each condition in $and must be an object',
          '$and',
          condition,
        )
      }
      return condition as unknown as QueryOperator
    })
  }

  evaluate(value: any, context?: any): boolean {
    return this.conditions.every((condition) =>
      condition.evaluate(value, context),
    )
  }
}

// $or operator
export class OrOperator implements LogicalOperator {
  type = 'logical' as const
  private conditions: QueryOperator[]

  constructor(conditions: QueryValue[]) {
    if (!Array.isArray(conditions)) {
      throw new QueryOperatorError(
        '$or requires an array of conditions',
        '$or',
        conditions,
      )
    }
    this.conditions = conditions.map((condition) => {
      if (!condition || typeof condition !== 'object') {
        throw new QueryOperatorError(
          'Each condition in $or must be an object',
          '$or',
          condition,
        )
      }
      return condition as unknown as QueryOperator
    })
  }

  evaluate(value: any, context?: any): boolean {
    return this.conditions.some((condition) =>
      condition.evaluate(value, context),
    )
  }
}

// $not operator
export class NotOperator implements LogicalOperator {
  type = 'logical' as const
  private condition: QueryOperator

  constructor(condition: QueryValue) {
    if (!isQueryOperator(condition)) {
      throw new QueryOperatorError(
        '$not requires a valid QueryOperator object condition',
        '$not',
        condition,
      )
    }
    this.condition = condition as unknown as QueryOperator
  }

  evaluate(value: any, context?: any): boolean {
    return !this.condition.evaluate(value, context)
  }
}

// $nor operator
export class NorOperator implements LogicalOperator {
  type = 'logical' as const
  private conditions: QueryOperator[]

  constructor(conditions: QueryValue[]) {
    if (!Array.isArray(conditions)) {
      throw new QueryOperatorError(
        '$nor requires an array of conditions',
        '$nor',
        conditions,
      )
    }
    this.conditions = conditions.map((condition) => {
      if (!condition || typeof condition !== 'object') {
        throw new QueryOperatorError(
          'Each condition in $nor must be an object',
          '$nor',
          condition,
        )
      }
      return condition as unknown as QueryOperator
    })
  }

  evaluate(value: any, context?: any): boolean {
    return !this.conditions.some((condition) =>
      condition.evaluate(value, context),
    )
  }
}

// Export a map of logical operators
export const logicalOperators = {
  $and: AndOperator,
  $or: OrOperator,
  $not: NotOperator,
  $nor: NorOperator,
} as const

// Type guard for logical operators
export function isLogicalOperator(value: any): value is LogicalOperator {
  return value && typeof value === 'object' && value.type === 'logical'
}
