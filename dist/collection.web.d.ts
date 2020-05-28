import CollectionBase, { Item, CollectionConfig } from './collection';
export interface CollectionConfigWeb<T> extends CollectionConfig<T> {
    storage: Storage;
}
export default class CollectionWeb<T extends Item> extends CollectionBase<T> {
    storage: Storage;
    constructor(config?: Partial<CollectionConfigWeb<T>>);
    __restore(): any;
    __store(obj: any): void;
}
//# sourceMappingURL=collection.web.d.ts.map