import { UnaryCondition } from './UnaryCondition'

export function $size(value: number): UnaryCondition {
  return (val: string | Array<any>) => val.length == value
}
