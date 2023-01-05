import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'

export function $every(value: (v: any) => true): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  return (v: Array<ValueType>) => v.every(value)
}
