import { ValueType, BPlusTree, Value } from 'b-pl-tree'
import { get } from 'lodash'
import { StoredList } from './StoredList'
import { Item } from './Item'
import fs from 'fs-extra'
import pathlib from 'path'
import { Cursor } from 'b-pl-tree/types/types/eval/Cursor'

export interface IList<T> extends AsyncIterable<T> {
  get(key: ValueType): Promise<T>
  set(key: ValueType, item: T): Promise<T>
  delete(key: ValueType): Promise<T>
  reset(): Promise<void>
  persist(): StoredList
  load(obj: StoredList): IList<T>
  readonly counter: number
  readonly length: number
  clone(): IList<T>
}

export class FileStorage<T extends Item, K extends ValueType>
  implements IList<T> {
  tree: BPlusTree<string, K>
  folder: string

  constructor(folder?: string) {
    this.folder = folder
    this.tree = new BPlusTree(32, true)
  }
  clone(): IList<T> {
    const res = new FileStorage<T, K>(this.folder)
    BPlusTree.deserialize(res.tree, BPlusTree.serialize(this.tree))
    return res
  }
  persist(): StoredList {
    return {
      folder: this.folder,
      tree: this.tree.toJSON(),
    }
  }
  load(obj: StoredList): IList<T> {
    throw new Error('Method not implemented.')
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.toArray()
  }

  async *toArray() {
    const it = this[Symbol.iterator]()
    for (let path of it) {
      yield await fs.readJSON(this.get_filename(path.value))
    }
  }

  private get_filename(key: ValueType) {
    return pathlib.join(this.folder, `${key.toString()}.json`)
  }

  async reset(): Promise<void> {
    await fs.remove(this.folder)
    this.tree.reset()
  }
  async get(key: K): Promise<T> {
    this.tree.findFirst(key)
    return await fs.readJSON(this.get_filename(this.tree.findFirst(key)))
  }
  async set(key: K, item: T): Promise<T> {
    await fs.writeJSON(this.get_filename(key), item)
    return item
  }
  async delete(key: K): Promise<T> {
    this.tree.findFirst(key)
    const item = await fs.readJSON(this.get_filename(key))
    await fs.unlink(this.get_filename(key))
    return item
  }
  get counter(): number {
    return this.tree.get_next_id()
  }
  get length(): number {
    return this.tree.size
  }
}

export class List<T extends Item> implements IList<T> {
  hash: { [key: string]: T } = {}
  _counter: number = 0
  _count: number = 0

  constructor(stored?: StoredList) {
    if (stored) {
      this.load(stored)
    }
  }

  clone(): IList<T> {
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

  load(obj: StoredList): IList<T> {
    this.hash = obj.hash
    this._count = obj._count
    this._counter = obj._counter
    return this
  }

  persist(): StoredList {
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
