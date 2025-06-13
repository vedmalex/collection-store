export type ValueOfType = {
  valueOf: () => number | string | boolean | bigint
}

export type ValueType = number | string | boolean | bigint | ValueOfType

export type Value = unknown

export function isValueOfType(value: unknown): value is ValueOfType {
  return (
    value !== null &&
    typeof value === 'object' &&
    'valueOf' in value &&
    typeof (value as any).valueOf === 'function'
  )
}

export function isValueType(value: unknown): value is ValueType {
  return (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    isValueOfType(value)
  )
}