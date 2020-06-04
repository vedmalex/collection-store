import CollectionBase, { Item, CollectionConfig } from './collection';
import fs from 'fs-extra';
import util from 'util';

const ensureFile = util.promisify(fs.ensureFile)
const writeJSON = util.promisify(fs.writeJSON)


export interface CollectionConfigNode<T> extends CollectionConfig<T> {
  path: string
}

export default class CollectionFile<T extends Item> extends CollectionBase<T> {
  file: string

  constructor(config?: Partial<CollectionConfigNode<T>>) {
    super(config);
    this.file = config.path || `${this.model}.json`;
  }
  async __restore() {
    await fs.ensureFile(this.file)
    const result = await fs.readFileSync(this.file)
    if (result && result.length > 0) {
      return JSON.parse(result.toString());
    }
  }

  async __store(obj) {
    await fs.ensureFile(this.file)
    await fs.writeJSON(this.file, obj, {
      spaces: 2
    })
  }
}
