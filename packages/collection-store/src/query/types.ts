// Basic types for all operators

// Определяем базовые типы значений
export type PrimitiveValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
export type ComplexValue = Date | RegExp
export type ArrayValue = Array<QueryValue>
export type ObjectValue = { [key: string]: QueryValue }
export type FunctionValue = (this: any, ...args: any[]) => any

// Базовый интерфейс для всех операторов
export interface QueryOperator {
  type: string
  evaluate(value: any, context?: any): boolean
  [key: string]: any // Добавляем индексную сигнатуру
}

// Рекурсивный тип для значений запроса
export type QueryValue =
  | PrimitiveValue
  | ComplexValue
  | ArrayValue
  | ObjectValue
  | FunctionValue
  | QueryOperator

// Type guard to check if something is a QueryOperator
export function isQueryOperator(value: any): value is QueryOperator {
  return (
    value && typeof value === 'object' && typeof value.evaluate === 'function'
  )
}

// Common error class for query operators
export class QueryOperatorError extends Error {
  override name: string
  operator: string
  value?: any

  constructor(message: string, operator: string, value?: any) {
    // Handle potential BigInt serialization issue in JSON.stringify
    let valueString = ''
    if (value !== undefined) {
      try {
        valueString = JSON.stringify(
          value,
          (_key, val) => (typeof val === 'bigint' ? val.toString() : val), // Convert BigInt to string
        )
      } catch (e) {
        valueString = String(value) // Fallback to simple string conversion
      }
    }
    super(
      `${operator}: ${message}${valueString ? ` (value: ${valueString})` : ''}`,
    )
    this.name = 'QueryOperatorError'
    this.operator = operator
    this.value = value
  }
}

// Types for specific operator categories
export interface LogicalOperator extends QueryOperator {
  type: 'logical'
}

export interface ElementOperator extends QueryOperator {
  type: 'element'
}

export interface ArrayOperator extends QueryOperator {
  type: 'array'
}

export interface EvaluationOperator extends QueryOperator {
  type: 'evaluation'
}

export interface BitwiseOperator extends QueryOperator {
  type: 'bitwise'
}

export interface TextSearchOperatorType extends QueryOperator {
  type: 'text'
}

export interface ComparisonOperator extends QueryOperator {
  type: 'comparison'
}

// Helper type for operator constructors
export type OperatorConstructor<T extends QueryOperator> = new (
  value: QueryValue,
) => T

export type Query = Record<string, any>;
