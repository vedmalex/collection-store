import { Dictionary } from '../../types/Dictionary';
import { BPlusTree, PortableBPlusTree, ValueType } from 'b-pl-tree';
export declare function serialize_indexes(indexes: Dictionary<BPlusTree<any, ValueType>>): Dictionary<PortableBPlusTree<any, ValueType>>;
