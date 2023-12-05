import { ValueType } from 'b-pl-tree'
import { get, set, unset, cloneDeep } from 'lodash'
import { StoredIList } from '../../types/StoredIList'
import { Item } from '../../types/Item'
import { IList } from '../IList'
import Collection from '../collection'
import { entity_create } from 'src/utils/entity_create'
import { entity_update } from 'src/utils/entity_update'
import { entity_delete } from 'src/utils/entity_delete'
import { is_stored_record } from 'src/utils/is_stored_record'
import { IStoredRecord } from 'src/types/IStoredRecord'

export class List<T extends Item> implements IList<T> {
  singlefile: boolean = true
  hash: { [key: string]: T } = {}
  _counter: number = 0
  _count: number = 0
  collection: Collection<T>
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
      result = cloneDeep(item.data)
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
    return this._count
  }

  set length(len) {
    if (len === 0) {
      this.reset()
    }
  }

  async set(_key: ValueType, item: T) {
    if (this.collection.validator?.(item) ?? true) {
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
      set(this.hash, this._counter, result)
      this._counter++
      this._count++
      return is_stored_record(item) ? item.data : item
    } else {
      throw new Error('Validation error')
    }
  }

  async update(_key: ValueType, item: T) {
    if (this.collection.validator?.(item) ?? true) {
      let result: T = item
      const record = get(this.hash, item[this.collection.id])
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
        set(this.hash, item[this.collection.id], res)
        result = res.data
      } else {
        set(this.hash, item[this.collection.id], cloneDeep(result))
      }
      return result
    } else {
      throw new Error('Validation error')
    }
  }

  async delete(i: ValueType) {
    const item = get(this.hash, i.toString())
    let result: T
    if (is_stored_record<T>(item)) {
      entity_delete(item)
      result = cloneDeep(item.data)
      this._count--
    } else {
      unset(this.hash, i.toString())
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
