// Экспортируем все типы
export * from './types'

// Экспортируем все операторы
export * from './logical'
export * from './element'
export * from './array'
export * from './evaluation'
export * from './bitwise'
export * from './text'
export * from './comparison'

// Экспортируем основные функции API
export * from './query'
export * from './build_query'
export * from './compile_query'

// Импортируем все операторы для создания общего объекта
import { logicalOperators } from './logical'
import { elementOperators } from './element'
import { arrayOperators } from './array'
import { evaluationOperators } from './evaluation'
import { bitwiseOperators } from './bitwise'
import { textSearchOperators } from './text'
import { comparisonOperators } from './comparison'
import { QueryOperator, QueryValue, QueryOperatorError } from './types'

// Объединяем все операторы в один объект
export const allOperators = {
  ...logicalOperators,
  ...elementOperators,
  ...arrayOperators,
  ...evaluationOperators,
  ...bitwiseOperators,
  ...textSearchOperators,
  ...comparisonOperators,
} as const

// Тип для всех доступных операторов
export type OperatorType = keyof typeof allOperators

// Тип для конструктора оператора
export type OperatorConstructor = new (value: QueryValue) => QueryOperator

// Функция для проверки, является ли строка оператором
export function isOperator(value: string): value is OperatorType {
  return value in allOperators
}

// Функция для создания оператора по имени
export function createOperator(
  operator: OperatorType,
  value: QueryValue,
): QueryOperator {
  const OperatorClass = allOperators[operator] as OperatorConstructor
  return new OperatorClass(value)
}

// Функция для валидации значения оператора
export function validateOperatorValue(
  operator: OperatorType,
  value: unknown,
): value is QueryValue {
  try {
    createOperator(operator, value as QueryValue)
    return true
  } catch (error) {
    if (error instanceof QueryOperatorError) {
      return false
    }
    throw error
  }
}

// Функция для получения типа оператора
export function getOperatorType(operator: QueryOperator): string {
  return operator.type
}

// Функция для проверки, является ли значение оператором определенного типа
export function isOperatorOfType<T extends QueryOperator>(
  value: unknown,
  type: string,
): value is T {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    (value as any).type === type
  )
}
