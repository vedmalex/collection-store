import { ValueType } from 'b-pl-tree'
import { get } from 'lodash'
import { StoredList } from './StoredList'

export interface IList<T> {
  get(key: ValueType): Promise<T>
  set(key: ValueType, item: T): Promise<T>
  delete(key: ValueType): Promise<T>
  reset(): void
  readonly counter: number
  readonly length: number
}

export class List<T> implements StoredList<T>, IList<T> {
  hash: { [key: string]: T } = {}
  _counter: number = 0
  _count: number = 0

  constructor(stored?: StoredList<T>) {
    if (stored) {
      this.load(stored)
    }
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

  reset() {
    this._count = 0
    this._counter = 0
    this.hash = {}
  }

  [Symbol.iterator]() {
    let self = this
    return (function* () {
      yield* self.keys
    })()
  }

  get keys() {
    return Object.keys(this.hash)
  }

  load(obj: StoredList<T>): IList<T> {
    this.hash = obj.hash
    this._count = obj._count
    this._counter = obj._counter
    return this
  }

  persist(): StoredList<T> {
    return {
      _count: this._count,
      _counter: this._counter,
      hash: this.hash,
    }
  }
  toArray(): Array<T> {
    return this.keys.map((k) => this.hash[k])
  }
}
