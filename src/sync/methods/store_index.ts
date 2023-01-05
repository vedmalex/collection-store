import _ from 'lodash'
import { IndexDef } from '../../types/IndexDef'
import { IndexStored } from 'src/types/IndexStored'
import { Item } from '../../types/Item'
import { Dictionary } from 'src/types/Dictionary'
import { store_index_def } from './store_index_def'
import CollectionMemory from '../collection-memory'

export function store_index<T extends Item>(
  collection: CollectionMemory<T>,
  input: Dictionary<IndexDef<T>>,
): Dictionary<IndexStored<T>> {
  return _.map(input, (index) => {
    return store_index_def(collection, index)
  }).reduce((res, cur) => {
    res[cur.key as string] = cur
    return res
  }, {})
}
