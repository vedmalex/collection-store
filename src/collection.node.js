import CollectionBase from './collection';
import fs from 'fs-extra';

export default class CollectionFile extends CollectionBase {
  constructor(config) {
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
