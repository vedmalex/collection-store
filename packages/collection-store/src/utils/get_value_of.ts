import { ValueType } from 'b-pl-tree'

export function get_value_of(v: ValueType) {
  if (typeof v === 'object' && v !== null && 'valueOf' in v && typeof v.valueOf === 'function') {
    return v.valueOf()
  } else {
    return v
  }
}