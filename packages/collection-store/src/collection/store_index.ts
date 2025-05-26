import * as _ from 'lodash-es'
import { IndexDef } from '../types/IndexDef'
import { IndexStored } from '../types/IndexStored'
import { Item } from '../types/Item'
import { Dictionary } from '../types/Dictionary'
import { store_index_def } from './store_index_def'
import Collection from '../collection'

export function store_index<T extends Item>(
  collection: Collection<T>,
  input: Dictionary<IndexDef<T>>,
): Dictionary<IndexStored<T>> {
  return _.map(input, (index) => {
    return store_index_def(collection, index)
  }).reduce((res, cur) => {
    res[cur.key as string] = cur
    return res
  }, {} as Dictionary<IndexStored<T>>)
}
