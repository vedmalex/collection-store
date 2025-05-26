import { Dictionary } from '../types/Dictionary'
import { BPlusTree, ValueType, PortableBPlusTree } from 'b-pl-tree'
import { serializeBPlusTree } from '../utils/btree-serialization'

export function serialize_indexes(
  indexes: Dictionary<BPlusTree<any, ValueType>>,
): Dictionary<PortableBPlusTree<any, ValueType>> {
  return Object.keys(indexes).reduce((res, cur) => {
    res[cur] = serializeBPlusTree(indexes[cur])
    return res
  }, {} as Dictionary<PortableBPlusTree<any, ValueType>>)
}
