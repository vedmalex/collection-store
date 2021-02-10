import _ from 'lodash'
import { IndexDef, IndexStored } from '../IndexDef'
import { Item } from '../Item'
import { Dictionary } from '../hash'
import { store_index_def } from './store_index_def'

export function store_index<T extends Item>(
  input: Dictionary<IndexDef<T>>,
): Dictionary<IndexStored<T>> {
  return _.map(input, (index) => {
    return store_index_def(index)
  }).reduce((res, cur) => {
    res[cur.key as string] = cur
    return res
  }, {})
}
