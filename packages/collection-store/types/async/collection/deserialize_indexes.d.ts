import { Dictionary } from 'src/types/Dictionary';
import { BPlusTree } from 'b-pl-tree';
import { PortableBPlusTree } from 'b-pl-tree/types/types/PortableBPlusTree';
export declare function deserialize_indexes(indexes: Dictionary<PortableBPlusTree<any, number>>): Dictionary<BPlusTree<any, number>>;
