import { Dictionary } from '../../types/Dictionary'
import { BPlusTree } from 'b-pl-tree'
import { PortableBPlusTree } from 'b-pl-tree/types/types/PortableBPlusTree'

export function deserialize_indexes(
  indexes: Dictionary<PortableBPlusTree<any, number>>,
) {
  return Object.keys(indexes).reduce((res, cur) => {
    res[cur] = BPlusTree.createFrom(indexes[cur])
    return res
  }, {} as Dictionary<BPlusTree<any, number>>)
}
