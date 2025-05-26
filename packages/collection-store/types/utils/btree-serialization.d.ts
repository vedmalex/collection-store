import { BPlusTree, ValueType, PortableBPlusTree } from 'b-pl-tree';
export interface SerializedBPlusTree {
    t: number;
    unique: boolean;
    root: any;
}
export declare function serializeBPlusTree<T, K extends ValueType>(tree: BPlusTree<T, K>): PortableBPlusTree<T, K>;
export declare function deserializeBPlusTree<T, K extends ValueType>(data: PortableBPlusTree<T, K>): BPlusTree<T, K>;
export declare function deserializeBPlusTreeInto<T, K extends ValueType>(tree: BPlusTree<T, K>, data: PortableBPlusTree<T, K>): void;
export declare function cloneBPlusTree<T, K extends ValueType>(source: BPlusTree<T, K>): BPlusTree<T, K>;
