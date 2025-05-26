import { Dictionary } from '../types/Dictionary';
import { BPlusTree, PortableBPlusTree, ValueType } from 'b-pl-tree';
export declare function deserialize_indexes(indexes: Dictionary<PortableBPlusTree<any, ValueType>>): Dictionary<BPlusTree<any, ValueType>>;
