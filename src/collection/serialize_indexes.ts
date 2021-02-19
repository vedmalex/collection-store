import { Dictionary } from '../hash'
import { BPlusTree, ValueType } from 'b-pl-tree'

export function serialize_indexes(
  indexes: Dictionary<BPlusTree<any, ValueType>>,
) {
  return Object.keys(indexes).reduce((res, cur) => {
    res[cur] = BPlusTree.serialize(indexes[cur])
    return res
  }, {})
}
