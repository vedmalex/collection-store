import { UnaryCondition } from './UnaryCondition'

/**
 * Returns a UnaryCondition function that checks if the given value exists (is
 * not undefined, null, or empty string).
 *
 * @param value - Whether to check for existence or non-existence.
 */
export function $exists(value: boolean): UnaryCondition {
  return (val) => {
    const res = val !== undefined && val !== null && val !== ''
    return value ? res : !res
  }
}
