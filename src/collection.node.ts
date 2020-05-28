import CollectionBase, { Item, CollectionConfig } from './collection';
import fs from 'fs-extra';

export interface CollectionConfigNode<T> extends CollectionConfig<T>{
  format: string
}

export default class CollectionFile<T extends Item> extends CollectionBase<T> {
  file: string

  constructor(config?: Partial<CollectionConfigNode<T>>) {
    super(config);
    this.file = config.format || `${this.model}.json`;
  }
  __restore() {
    fs.ensureFileSync(this.file);
    let result = fs.readFileSync(this.file);
    if (result && result.toString()) {
      return JSON.parse(result);
    }
  }
  __store(obj) {
    fs.ensureFileSync(this.file);
    fs.writeFileSync(this.file, JSON.stringify(obj));
  }
}
