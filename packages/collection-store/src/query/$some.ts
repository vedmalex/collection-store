import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'
import { get_value_of } from '../utils/get_value_of'

export function $some(value: (v: any) => true): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  return (v: Array<ValueType>) => v.map(get_value_of).some(value)
}
