import { $and } from './$and'
import { build_query } from './build_query'
import { UnaryCondition, UnaryConditionOperation } from './UnaryCondition'

export function query(
  obj: unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition {
  const q = build_query(obj, options)
  if (typeof q == 'object') {
    return $and(
      Object.keys(q).reduce((res, key) => {
        res.push({ [key]: q[key] } as UnaryConditionOperation)
        return res
      }, [] as Array<any>),
    )
  } else if (typeof q == 'function') {
    return q
  } else {
    throw new Error('nonsense')
  }
}
