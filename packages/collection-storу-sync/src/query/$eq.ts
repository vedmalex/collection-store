import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'

/**
 * Returns a unary condition function that checks if a value is equal to the
 * provided value. Handles undefined, Date and other value types.
 */
export function $eq(value: ValueType): UnaryCondition {
  if (value === undefined) return (v: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => value.valueOf() == v.valueOf()
  } else {
    return (v: ValueType) => value == v
  }
}
