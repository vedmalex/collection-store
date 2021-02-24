import { ValueType, BPlusTree } from 'b-pl-tree'
import { StoredIList } from './StoredIList'
import { Item } from '../Item'
import fs from 'fs-extra'
import pathlib from 'path'
import { IList } from '../interfaces/IList'
import { Collection } from 'src'

export class FileStorage<T extends Item, K extends ValueType>
  implements IList<T> {
  //  хранить промисы типа кэширование данных к которым был доступ, и которые не обновлялись
  // а на обновление выставлять новый промис
  // таким образом данные всегда будут свежими... если нет другого читателя писателя файлов
  // можно использовать библиотеку для монитроинга за файлами
  tree: BPlusTree<string, K> = new BPlusTree(32, true)
  get folder(): string {
    return this.collection.model
  }
  exists: Promise<boolean>
  collection: Collection<T>
  construct() {
    return new FileStorage<T, K>()
  }

  init(collection: Collection<T>): IList<T> {
    this.collection = collection
    this.exists = fs
      .ensureDir(this.folder)
      .then((_) => true)
      .catch((_) => false)
    return this
  }
  async clone(): Promise<IList<T>> {
    if (this.exists) {
      const res = new FileStorage<T, K>()
      BPlusTree.deserialize(res.tree, BPlusTree.serialize(this.tree))
      return res
    } else {
      throw new Error('folder not found')
    }
  }
  persist(): StoredIList {
    return {
      counter: this._counter,
      tree: BPlusTree.serialize(this.tree),
    }
  }

  load(obj: StoredIList): IList<T> {
    this._counter = obj.counter
    BPlusTree.deserialize(this.tree, obj.tree)
    return this
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.toArray()
  }

  async *toArray() {
    if (await this.exists) {
      const it = this.tree.each()(this.tree)
      for (const path of it) {
        yield await fs.readJSON(this.get_path(path.value))
      }
    } else {
      throw new Error('folder not found')
    }
  }

  private key_filename(key: ValueType) {
    return `${key.toString()}.json`
  }

  private set_path(key: ValueType) {
    return pathlib.join(this.folder, this.key_filename(key))
  }

  private get_path(value: string) {
    return pathlib.join(this.folder, value)
  }

  async reset(): Promise<void> {
    if (await this.exists) {
      await fs.remove(this.folder)
      this.tree.reset()
      this.exists = fs
        .ensureDir(this.folder)
        .then((_) => true)
        .catch((_) => false)
    } else {
      throw new Error('folder not found')
    }
  }
  async get(key: K): Promise<T> {
    if (await this.exists) {
      return await fs.readJSON(this.get_path(this.tree.findFirst(key)))
    } else {
      throw new Error('folder not found')
    }
  }

  async set(key: K, item: T): Promise<T> {
    if (await this.exists) {
      await fs.writeJSON(this.set_path(key), item)
      this.tree.insert(key, this.key_filename(key))
      return item
    } else {
      throw new Error('folder not found')
    }
  }
  async delete(key: K): Promise<T> {
    if (await this.exists) {
      const value = this.tree.findFirst(key)
      const item = await fs.readJSON(this.get_path(value))
      this.tree.remove(key)
      await fs.unlink(this.get_path(value))
      return item
    } else {
      throw new Error('folder not found')
    }
  }

  _counter: number = 0
  get counter(): number {
    return this._counter
  }
  get length(): number {
    return this.tree.size
  }
}
