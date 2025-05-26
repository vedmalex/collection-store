import {
  BPlusTree,
  ValueType,
  PortableBPlusTree,
  serializeTree,
  deserializeTree,
  createTreeFrom
} from 'b-pl-tree'

export interface SerializedBPlusTree {
  t: number
  unique: boolean
  root: any
}

export function serializeBPlusTree<T, K extends ValueType>(
  tree: BPlusTree<T, K>
): PortableBPlusTree<T, K> {
  return serializeTree(tree)
}

export function deserializeBPlusTree<T, K extends ValueType>(
  data: PortableBPlusTree<T, K>
): BPlusTree<T, K> {
  return createTreeFrom<T, K>(data)
}

export function deserializeBPlusTreeInto<T, K extends ValueType>(
  tree: BPlusTree<T, K>,
  data: PortableBPlusTree<T, K>
): void {
  deserializeTree(tree, data)
}

export function cloneBPlusTree<T, K extends ValueType>(
  source: BPlusTree<T, K>
): BPlusTree<T, K> {
  const serialized = serializeTree(source)
  return createTreeFrom<T, K>(serialized)
}