import { $and } from './$and'
import { UnaryCondition, UnaryConditionOperation } from './UnaryCondition'
import { build_query } from './build_query'

export function query(
  obj: unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition {
  const q = build_query(obj, options)
  if (typeof q === 'object') {
    return $and(
      Object.keys(q).reduce(
        (res, key) => {
          res.push({ [key]: q[key] } as UnaryConditionOperation)
          return res
        },
        [] as Array<any>,
      ),
    )
  }
  if (typeof q === 'function') {
    return q
  }
  throw new Error('nonsense')
}
