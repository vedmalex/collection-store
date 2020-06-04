import CollectionBase, { Item, CollectionConfig } from './collection';
import fs from 'fs-extra';
import util from 'util';

const ensureFile = util.promisify(fs.ensureFile)
const writeJSON = util.promisify(fs.writeJSON)


export interface CollectionConfigNode<T> extends CollectionConfig<T> {
  format: string
}

export default class CollectionFile<T extends Item> extends CollectionBase<T> {
  file: string

  constructor(config?: Partial<CollectionConfigNode<T>>) {
    super(config);
    this.file = config.format || `${this.model}.json`;
  }
  __restore() {
    return fs.ensureFile(this.file)
      .then(_ => fs.readFileSync(this.file))
      .then(result => {
        if (result && result.toString()) {
          return JSON.parse(result.toString());
        }
      })
  }
  __store(obj) {
    return fs.ensureFile(this.file)
      .then(_ => fs.writeJSON(this.file, obj, {
        spaces: 2
      }))
  }
}
