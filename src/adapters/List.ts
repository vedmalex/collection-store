import { ValueType } from 'b-pl-tree'
import { get } from 'lodash'
import { StoredIList } from './StoredIList'
import { Item } from '../Item'
import { IList } from '../interfaces/IList'
import Collection from '../collection'

export class List<T extends Item> implements IList<T> {
  hash: { [key: string]: T } = {}
  _counter: number = 0
  _count: number = 0
  collection: Collection<T>

  constructor(stored?: StoredIList) {
    if (stored) {
      this.load(stored)
    }
  }
  init(collection: Collection<T>): IList<T> {
    this.collection = collection
    return this as IList<T>
  }

  async clone(): Promise<IList<T>> {
    const list = new List<T>()
    list.load(this.persist())
    return list
  }

  async get(key: ValueType) {
    return get(this.hash, String(key))
  }

  get counter() {
    return this._counter
  }

  get length() {
    return this._count
  }

  set length(len) {
    if (len === 0) {
      this.reset()
    }
  }

  async set(key: ValueType, item: T) {
    this.hash[this._counter] = item
    this._counter++
    this._count++
    return item
  }

  async delete(i: ValueType) {
    let result = this.hash[i.toString()]
    delete this.hash[i.toString()]
    this._count--
    return result
  }

  async reset() {
    this._count = 0
    this._counter = 0
    this.hash = {}
  }

  get keys() {
    return Object.keys(this.hash)
  }

  load(obj: StoredIList): IList<T> {
    this.hash = obj.hash
    this._count = obj._count
    this._counter = obj._counter
    return this
  }

  persist(): StoredIList {
    return {
      _count: this._count,
      _counter: this._counter,
      hash: this.hash,
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.toArray()
  }

  async *toArray() {
    for (let key of this.keys) {
      yield this.hash[key]
    }
  }
}
