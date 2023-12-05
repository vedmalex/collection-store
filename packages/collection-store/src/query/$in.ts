import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'

export function $in(value: Array<ValueType>): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => value.includes(v.valueOf())
  } else {
    return (v: ValueType) => value.includes(v)
  }
}
