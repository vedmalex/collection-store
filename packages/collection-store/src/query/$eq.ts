import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'

export function $eq(value: ValueType): UnaryCondition {
  if (value === undefined) return (v: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => value.valueOf() == v.valueOf()
  } else {
    return (v: ValueType) => value == v
  }
}
