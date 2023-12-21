import { $eq } from './$eq'
import { $gt } from './$gt'
import { $gte } from './$gte'
import { $lt } from './$lt'
import { $lte } from './$lte'
import { $ne } from './$ne'
import { $in } from './$in'
import { $nin } from './$nin'
import { $some } from './$some'
import { $every } from './$every'
import { $exists } from './$exists'
import { $size } from './$size'
import { $match } from './$match'
import { $or } from './$or'
import { $and } from './$and'
import { UnaryCondition, UnaryConditionOperation } from './UnaryCondition'

export function build_query(
  _obj: unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition | UnaryConditionOperation {
  const res: Array<UnaryCondition | UnaryConditionOperation> = []
  if (typeof _obj == 'object' && !(_obj instanceof Date) && _obj) {
    const obj = _obj as Record<string, any>
    const keys = Object.keys(obj)
    for (const prop of keys) {
      if (options?.[prop]) {
        res.push(options[prop](obj[prop]))
      } else {
        switch (prop) {
          case '$eq':
            res.push($eq(obj['$eq']))
            break
          case '$gt':
            res.push($gt(obj['$gt']))
            break
          case '$gte':
            res.push($gte(obj['$gte']))
            break
          case '$lt':
            res.push($lt(obj['$lt']))
            break
          case '$lte':
            res.push($lte(obj['$lte']))
            break
          case '$ne':
            res.push($ne(obj['$ne']))
            break
          case '$in':
            res.push($in(obj['$in']))
            break
          case '$nin':
            res.push($nin(obj['$nin']))
            break
          case '$some':
            res.push($some(obj['$some']))
            break
          case '$every':
            res.push($every(obj['$every']))
            break
          case '$exists':
            res.push($exists(obj['$exists']))
            break
          case '$every':
            res.push($every(obj['$every']))
            break
          case '$match':
            res.push($match(obj['$match'], 'g'))
            break
          case '$imatch':
            res.push($match(obj['$imatch'], 'ig'))
            break
          case '$size':
            res.push($size(obj['$size']))
            break
          case '$and':
            res.push($and(obj['$and']))
            break
          case '$or':
            res.push($or(obj['$or']))
            break
          default:
            res.push({ [prop]: build_query(obj[prop], options) })
        }
      }
    }
    if (res.length == 1) {
      return res[0]
    } else {
      return options?.$and(res) ?? $and(res as any)
    }
  } else if (
    typeof _obj == 'number' ||
    typeof _obj == 'bigint' ||
    typeof _obj == 'string' ||
    _obj instanceof Date
  ) {
    return $eq(_obj)
  }
  throw new Error('unknown type')
}
