import { StoredIList } from './StoredIList'
import { IndexDef, IndexStored } from '../IndexDef'
import { Item } from '../Item'
import { Dictionary } from '../hash'
import { PortableBPlusTree } from 'b-pl-tree/types/types/PortableBPlusTree'

export interface StoredData<T extends Item> {
  list: StoredIList
  indexes: Dictionary<PortableBPlusTree<any, number>>
  indexDefs: Dictionary<IndexStored<T>>
  id: string
  ttl?: number
  rotate?: number
}
