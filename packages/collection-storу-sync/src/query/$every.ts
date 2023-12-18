import { ValueType } from 'b-pl-tree'
import { UnaryCondition } from './UnaryCondition'

/**
 * Checks if every element in the array passes the provided predicate function.
 *
 * @param value - The predicate function to test each element against
 * @returns A UnaryCondition function that tests if all array elements pass the
 *     predicate
 */
export function $every(value: (v: any) => true): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  return (v: Array<ValueType>) => v.every(value)
}
