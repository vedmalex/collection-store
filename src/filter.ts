import { ValueType } from 'b-pl-tree'

export function $eq(value: ValueType): UnaryCondition {
  if (value === undefined) return (v: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => value.valueOf() == v.valueOf()
  } else {
    return (v: ValueType) => value == v
  }
}

export function $gt(value: ValueType): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => v.valueOf() > value.valueOf()
  } else {
    return (v: ValueType) => v > value
  }
}

export function $gte(value: ValueType): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => v.valueOf() >= value.valueOf()
  } else {
    return (v: ValueType) => v >= value
  }
}

export function $lt(value: ValueType): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => v.valueOf() < value.valueOf()
  } else {
    return (v: ValueType) => v < value
  }
}

export function $lte(value: ValueType): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => v.valueOf() <= value.valueOf()
  } else {
    return (v: ValueType) => v <= value
  }
}

export function $ne(value: ValueType): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => v.valueOf() != value.valueOf()
  } else {
    return (v: ValueType) => v != value
  }
}

export function $in(value: Array<ValueType>): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => value.includes(v.valueOf())
  } else {
    return (v: ValueType) => value.includes(v)
  }
}

export function $nin(value: Array<ValueType>): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  if (value instanceof Date) {
    return (v: ValueType) => !value.includes(v.valueOf())
  } else {
    return (v: ValueType) => !value.includes(v)
  }
}

export function $some(value: (v: any) => true): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  return (v: Array<ValueType>) => v.some(value)
}

export function $every(value: (v: any) => true): UnaryCondition {
  if (value === undefined) return (_: ValueType) => false
  return (v: Array<ValueType>) => v.every(value)
}

export function $exists(value: boolean): UnaryCondition {
  return (val) => {
    const res = val !== undefined && val !== null && val !== ''
    return value ? res : !res
  }
}

export function $size(value: number): UnaryCondition {
  return (val: string | Array<any>) => val.length == value
}

export function $match(value: RegExp | string, flags?: string): UnaryCondition {
  if (typeof value === 'object') {
    return (val: string) => value.test(val)
  } else {
    const reg = new RegExp(value, flags)
    return (val: string) => reg.test(val)
  }
}

export type UnaryCondition = (v) => boolean

export function $or(value: Array<{ [key: string]: UnaryCondition }>) {
  return (val: object) => {
    for (let condition of value) {
      for (let prop of Object.keys(condition))
        if (condition[prop](val[prop])) {
          return true
        }
    }
  }
}

export function $and(value: Array<{ [key: string]: UnaryCondition }>) {
  return (val: object) => {
    for (let condition of value) {
      for (let prop of Object.keys(condition))
        if (!condition[prop](val[prop])) {
          return false
        }
    }
    return true
  }
}

const sample = { name: { $eq: '10', $lt: '10' } }

function build_query(
  obj: unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition | { [key: string]: UnaryCondition } {
  let res = []
  if (typeof obj == 'object' && !(obj instanceof Date)) {
    const keys = Object.keys(obj)
    for (let prop of keys) {
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
      return options?.$and(res) ?? $and(res)
    }
  } else if (
    typeof obj == 'number' ||
    typeof obj == 'bigint' ||
    typeof obj == 'string' ||
    obj instanceof Date
  ) {
    return $eq(obj)
  } else {
    throw new Error('unknown type')
  }
}

export function query(
  obj: unknown,
  options?: { [op: string]: (...args: Array<any>) => UnaryCondition },
): UnaryCondition {
  const q = build_query(obj, options)
  if (typeof q == 'object') {
    return $and(
      Object.keys(q).reduce((res, key) => {
        res.push({ [key]: q[key] })
        return res
      }, []),
    )
  } else if (typeof q == 'function') {
    return q
  } else {
    throw new Error('nonsense')
  }
}
