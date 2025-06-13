import { get } from 'lodash-es'
import { ValueType } from 'b-pl-tree'

export function get_value(
  item: any,
  key: unknown,
  process?: (value: any) => any,
): ValueType {
  if (process) {
    // If process function exists, it handles both single and composite keys
    return process(item)
  }

  // Fallback: extract single key value
  return get(item, key as any) as unknown as ValueType
}
