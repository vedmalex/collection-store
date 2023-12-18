import { Dictionary } from '../../types/Dictionary'
import { BPlusTree, PortableBPlusTree, ValueType } from 'b-pl-tree'

export function serialize_indexes(
  indexes: Dictionary<BPlusTree<any, ValueType>>,
) {
  return Object.keys(indexes).reduce((res, cur) => {
    res[cur] = BPlusTree.serialize(indexes[cur])
    return res
  }, {} as Dictionary<PortableBPlusTree<any, ValueType>>)
}
