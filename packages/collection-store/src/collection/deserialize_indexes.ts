import { Dictionary } from '../types/Dictionary'
import { BPlusTree, PortableBPlusTree, ValueType } from 'b-pl-tree'
import { deserializeBPlusTree } from '../utils/btree-serialization'

export function deserialize_indexes(
  indexes: Dictionary<PortableBPlusTree<any, ValueType>>,
): Dictionary<BPlusTree<any, ValueType>> {
  return Object.keys(indexes).reduce((res, cur) => {
    res[cur] = deserializeBPlusTree(indexes[cur])
    return res
  }, {} as Dictionary<BPlusTree<any, ValueType>>)
}
