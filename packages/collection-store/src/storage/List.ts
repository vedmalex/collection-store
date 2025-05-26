import { ValueType } from 'b-pl-tree'
import { get, set, unset, cloneDeep } from 'lodash-es'
import { StoredIList } from '../types/StoredIList'
import { Item } from '../types/Item'
import { IList } from '../IList'
import Collection from '../collection'
import { entity_create } from '../utils/entity_create'
import { entity_update } from '../utils/entity_update'
import { entity_delete } from '../utils/entity_delete'
import { is_stored_record } from '../utils/is_stored_record'
import { IStoredRecord } from '../types/IStoredRecord'

export class List<T extends Item> implements IList<T> {
  get name() {
    return 'List' as const
  }
  singlefile: boolean = true
  hash: { [key: string]: T } = {}
  _counter: number = 0
  _count: number = 0
  collection!: Collection<T>
  exists: Promise<boolean> = Promise.resolve(true)

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
    const item = get(this.hash, String(key))
    let result: T
    if (is_stored_record<T>(item)) {
      result = cloneDeep<T>(item.data!)
      if (!this.collection.audit) {
        set(this.hash, String(key), result)
      }
    } else {
      result = cloneDeep(item)
    }
    return result
  }

  get counter() {
    return this._counter
  }

  get length() {
    return Object.keys(this.hash).length
  }

  set length(len) {
    if (len === 0) {
      this.reset()
    }
  }

  async set(key: ValueType, item: T) {
    let valiadtor = this.collection.validator(item)
    if (valiadtor.success) {
      let result: T | IStoredRecord<T>
      if (this.collection.audit) {
        result = entity_create(
          item[this.collection.id],
          cloneDeep(item),
          this.collection.validation,
        )
      } else {
        result = cloneDeep(item)
      }

      const keyStr = String(key)
      const exists = Object.prototype.hasOwnProperty.call(this.hash, keyStr)

      // Use the provided key instead of _counter
      set(this.hash, keyStr, result)

      // Only increment counters if this is a new key
      if (!exists) {
        this._counter++
        this._count++
      }

      return is_stored_record(item) ? item.data : item
    }
    throw new Error('Validation error')
  }

  async update(key: ValueType, item: T) {
    let valiadtor = this.collection.validator(item)
    if (valiadtor.success) {
      let result: T = item
      const record = get(this.hash, String(key))
      if (this.collection.audit) {
        let res: T | IStoredRecord<T>
        if (!is_stored_record(record)) {
          res = entity_create(
            item[this.collection.id],
            item,
            this.collection.validation,
          )
        } else {
          res = entity_update(record, cloneDeep(item))
        }
        set(this.hash, String(key), res)
        result = res.data
      } else {
        set(this.hash, String(key), cloneDeep(result))
      }
      return result
    }
    throw new Error('Validation error')
  }

  async delete(i: ValueType) {
    const item = get(this.hash, i?.toString() ?? 'undefined')
    let result: T
    if (is_stored_record<T>(item)) {
      entity_delete(item)
      result = cloneDeep(item.data)
      this._count--
    } else {
      unset(this.hash, i?.toString() ?? 'undefined')
      this._count--
      result = cloneDeep(item)
    }
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

  construct() {
    return new List<T>()
  }

  persist(): StoredIList {
    return {
      counter: this._counter,
      tree: {} as any, // List doesn't use tree, but interface requires it
      _count: this._count,
      _counter: this._counter,
      hash: this.hash,
    }
  }

  get forward(): AsyncIterable<T> {
    return {
      [Symbol.asyncIterator]: () => this.toArray(),
    }
  }
  get backward(): AsyncIterable<T> {
    return {
      [Symbol.asyncIterator]: () => this.toArrayReverse(),
    }
  }

  async *toArray() {
    for (const key of this.keys) {
      yield get(this.hash, key)
    }
  }
  async *toArrayReverse() {
    for (const key of this.keys.reverse()) {
      yield get(this.hash, key)
    }
  }
}
