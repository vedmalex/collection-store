import { Dictionary } from '../hash'
import { BPlusTree } from 'b-pl-tree'

export function serialize_indexes(indexes: Dictionary<BPlusTree<any, number>>) {
  return Object.keys(indexes).reduce((res, cur) => {
    res[cur] = indexes[cur].toJSON()
    return res
  }, {})
}
