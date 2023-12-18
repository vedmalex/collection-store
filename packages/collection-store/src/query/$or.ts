import { UnaryCondition } from './UnaryCondition'

export function $or(value: Array<{ [key: string]: UnaryCondition }>) {
  return (val: { [key: string]: unknown }) => {
    for (const condition of value) {
      for (const prop of Object.keys(condition)) {
        if (condition[prop](val[prop])) {
          return true
        }
      }
    }
    return false
  }
}
