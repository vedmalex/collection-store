import { PortableBPlusTree, ValueType } from 'b-pl-tree';
export interface StoredIList {
    keyField?: string;
    counter: number;
    tree: PortableBPlusTree<any, ValueType>;
    [key: string]: any;
}
