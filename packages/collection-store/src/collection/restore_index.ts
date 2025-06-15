import * as _ from 'lodash-es'
import { IndexDef } from '../types/IndexDef'
import { IndexStored } from '../types/IndexStored'
import { Item } from '../types/Item'
import { Dictionary } from '../types/Dictionary'
import { restore_index_def } from './restore_index_def'
import Collection from '../core/Collection'

export function restore_index<T extends Item>(
  collection: Collection<T>,
  input: Dictionary<IndexStored<T>>,
): Dictionary<IndexDef<T>> {
  return _.map(input, (index) => {
    return restore_index_def(collection, index)
  }).reduce((res, cur) => {
    res[cur.key] = cur
    return res
  }, {} as Dictionary<IndexDef<T>>)
}
