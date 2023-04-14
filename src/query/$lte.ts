import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'

export function $lte(value: ValueType): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: Date) => v.valueOf() <= value.valueOf()
  } else {
    return (v: ValueType) => v <= value
  }
}
