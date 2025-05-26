import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'
import { get_value_of } from '../utils/get_value_of'

export function $gte(value: ValueType): UnaryCondition {
  const val = get_value_of(value)
  if (val === undefined) return (_: ValueType) => false
  return (v: ValueType) => get_value_of(v) >= (value ?? 0)
}
