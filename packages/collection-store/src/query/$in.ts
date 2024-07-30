import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'
import { get_value_of } from '../utils/get_value_of'

export function $in(value: Array<ValueType>): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  const val = value.map(get_value_of)
  return (v: ValueType) => val.includes((get_value_of(v)))
}
