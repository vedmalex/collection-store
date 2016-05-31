import CollectionBase from './collection';

export default class CollectionWeb extends CollectionBase{
  constructor(config) {
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
