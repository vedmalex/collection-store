import CollectionBase, { Item, CollectionConfig } from './collection';
export interface CollectionConfigNode<T> extends CollectionConfig<T> {
    format: string;
}
export default class CollectionFile<T extends Item> extends CollectionBase<T> {
    file: string;
    constructor(config?: Partial<CollectionConfigNode<T>>);
    __restore(): any;
    __store(obj: any): void;
}
//# sourceMappingURL=collection.node.d.ts.map