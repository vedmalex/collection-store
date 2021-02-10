import _ from 'lodash'
import { IndexDef, IndexStored } from '../IndexDef'
import { Item } from '../Item'
import { Dictionary } from '../hash'
import { restore_index_def } from './restore_index_def'

export function restore_index<T extends Item>(
  input: Dictionary<IndexStored<T>>,
): Dictionary<IndexDef<T>> {
  return _.map(input, (index) => {
    return restore_index_def(index)
  }).reduce((res, cur) => {
    res[cur.key as string] = cur
    return res
  }, {})
}
