import { UnaryCondition } from './UnaryCondition'

export function $exists(value: boolean): UnaryCondition {
  return (val) => {
    const res = val !== undefined && val !== null && val !== ''
    return value ? res : !res
  }
}
