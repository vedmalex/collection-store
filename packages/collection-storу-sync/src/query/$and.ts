import { UnaryCondition } from './UnaryCondition'

/**
 * Performs a logical AND on an array of conditions.
 *
 * Accepts an array of condition objects, where each object contains a single
 * condition keyed by the property it applies to. Iterates through the
 * conditions and returns false if any condition returns false for the given
 * value. Otherwise returns true.
 */
export function $and(value: Array<{ [key: string]: UnaryCondition }>) {
  return (val: { [key: string]: unknown }) => {
    for (const condition of value) {
      for (const prop of Object.keys(condition))
        if (!condition[prop](val[prop])) {
          return false
        }
    }
    return true
  }
}
