import { UnaryCondition } from './UnaryCondition'

export function $match(value: RegExp | string, flags?: string): UnaryCondition {
  if (typeof value === 'object') {
    return (val: string) => value.test(val)
  } else {
    const reg = new RegExp(value, flags)
    return (val: string) => reg.test(val)
  }
}
