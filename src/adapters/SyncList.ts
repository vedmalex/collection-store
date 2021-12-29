import { ValueType } from 'b-pl-tree'
import { get, set, unset, cloneDeep } from 'lodash'
import { StoredIList } from './StoredIList'
import { Item } from '../Item'
import CollectionMemory from '../collection-memory'
import { entity_create, entity_update } from '../interfaces/StorageAdapter'
import {
  IStoredRecord,
  is_stored_record,
  entity_delete,
} from '../interfaces/StorageAdapter'

export class SyncList<T extends Item> {
  hash: { [key: string]: T } = {}
  _counter: number = 0
  _count: number = 0
  collection: CollectionMemory<T>

  init(collection: CollectionMemory<T>): SyncList<T> {
    this.collection = collection
    return this
  }

  clone(): SyncList<T> {
    const list = new SyncList<T>()
    list.load(this.persist())
    return list
  }

  get(key: ValueType) {
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

  set(_key: ValueType, item: T) {
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

  update(_key: ValueType, item: T) {
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

  delete(i: ValueType) {
    const item = get(this.hash, i.toString())
    let result: T
    if (is_stored_record<T>(item)) {
      entity_delete(item)
      result = cloneDeep(item.data)
      this._count -= 1
    } else {
      unset(this.hash, i.toString())
      this._count -= 1
      result = cloneDeep(item)
    }
    return result
  }

  reset() {
    this._count = 0
    this._counter = 0
    this.hash = {}
  }

  get keys() {
    return Object.keys(this.hash)
  }

  load(obj: StoredIList): SyncList<T> {
    this.hash = obj.hash
    this._count = obj._count
    this._counter = obj._counter
    return this
  }

  construct() {
    return new SyncList<T>()
  }

  persist(): StoredIList {
    return {
      _count: this._count,
      _counter: this._counter,
      hash: this.hash,
    }
  }

  get forward(): Iterable<T> {
    return {
      [Symbol.iterator]: () => this.toArray(),
    }
  }
  get backward(): Iterable<T> {
    return {
      [Symbol.iterator]: () => this.toArrayReverse(),
    }
  }

  *toArray() {
    for (const key of this.keys) {
      yield get(this.hash, key)
    }
  }
  *toArrayReverse() {
    for (const key of this.keys.reverse()) {
      yield get(this.hash, key)
    }
  }
}
