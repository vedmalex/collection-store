import _ from 'lodash'
import { IndexDef } from '../types/IndexDef'
import { IndexStored } from 'src/types/IndexStored'
import { Item } from '../types/Item'
import { Dictionary } from 'src/types/Dictionary'
import { restore_index_def } from './restore_index_def'
import Collection from '../collection'
import CollectionMemory from '../collection-memory'

export function restore_index<T extends Item>(
  collection: Collection<T> | CollectionMemory<T>,
  input: Dictionary<IndexStored<T>>,
): Dictionary<IndexDef<T>> {
  return _.map(input, (index) => {
    return restore_index_def(collection, index)
  }).reduce((res, cur) => {
    res[cur.key as string] = cur
    return res
  }, {})
}
