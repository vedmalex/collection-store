
import CollectionBase, { Item, CollectionConfig } from './collection';

export interface CollectionConfigWeb<T> extends CollectionConfig<T>{
  storage: Storage
}

export default class CollectionWeb<T extends Item> extends CollectionBase<T>{
  storage: Storage
  constructor(config?:Partial<CollectionConfigWeb<T>>) {
    super(config);
    this.storage = config.storage || localStorage;
  }
  __restore() {
    return JSON.parse(this.storage.getItem(this.model));
  }
  __store(obj) {
    this.storage.setItem(this.model,JSON.stringify(obj));
  }
}
