
import CollectionBase, { Item, CollectionConfig, StoredData } from './collection';

export interface CollectionConfigWeb<T> extends CollectionConfig<T> {
  storage: Storage
}

export default class CollectionWeb<T extends Item> extends CollectionBase<T>{
  storage: Storage
  constructor(config?: Partial<CollectionConfigWeb<T>>) {
    super(config);
    this.storage = config.storage || localStorage;
  }
  __restore(): Promise<StoredData<T>> {
    return new Promise((res, rej) => {
      res(JSON.parse(this.storage.getItem(this.model)));
    })
  }
  __store(obj): Promise<void> {
    return new Promise((res, rej) => {
      this.storage.setItem(this.model, JSON.stringify(obj));
    })
  }
}
