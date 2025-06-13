import { PortableBPlusTree, ValueType } from 'b-pl-tree'

//JSON not suitable
export interface StoredIList {
  keyField?: string
  counter: number
  tree: PortableBPlusTree<any, ValueType>
  [key: string]: any
}
