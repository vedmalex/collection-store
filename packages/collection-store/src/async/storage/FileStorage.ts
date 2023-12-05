import { ValueType, BPlusTree } from 'b-pl-tree'
import { StoredIList } from '../../types/StoredIList'
import { Item } from '../../types/Item'
import fs from 'fs-extra'
import pathlib from 'path'
import { IList } from '../IList'
import { Collection } from 'src'
import { entity_delete } from 'src/utils/entity_delete'
import { entity_update } from 'src/utils/entity_update'
import { IStoredRecord } from 'src/types/IStoredRecord'
import { entity_create } from 'src/utils/entity_create'
import { is_stored_record } from 'src/utils/is_stored_record'
import { cloneDeep } from 'lodash'

export class FileStorage<T extends Item, K extends ValueType>
  implements IList<T>
{
  singlefile: boolean = false

  //  хранить промисы типа кэширование данных к которым был доступ, и которые не обновлялись
  // а на обновление выставлять новый промис
  // таким образом данные всегда будут свежими... если нет другого читателя писателя файлов
  // можно использовать библиотеку для монитроинга за файлами
  tree: BPlusTree<string, K> = new BPlusTree(32, true)
  get folder(): string {
    return pathlib.join(this.collection.root, this.collection.model)
  }
  constructor(private keyField?: string) {}
  exists: Promise<boolean>
  collection: Collection<T>
  construct() {
    return new FileStorage<T, K>()
  }

  init(collection: Collection<T>): IList<T> {
    this.collection = collection
    if (this.keyField && !this.collection.indexDefs[this.keyField].unique) {
      throw new Error(`key field ${this.keyField} is not unique`)
    }
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
      keyField: this.keyField,
      counter: this._counter,
      tree: BPlusTree.serialize(this.tree),
    }
  }

  load(obj: StoredIList): IList<T> {
    this._counter = obj.counter
    // prefer name that in configuration
    this.keyField = !obj.keyField
      ? this.keyField
      : this.keyField
      ? this.keyField
      : obj.keyField
    BPlusTree.deserialize(this.tree, obj.tree)
    return this
  }

  get forward() {
    return {
      [Symbol.asyncIterator]: () => this.toArray(),
    }
  }

  get backward() {
    return {
      [Symbol.asyncIterator]: () => this.toArrayReverse(),
    }
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

  async *toArrayReverse() {
    if (await this.exists) {
      const it = this.tree.each(false)(this.tree)
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
      const value = this.tree.findFirst(key)
      if (value) {
        const location = this.get_path(value)
        const result: T | IStoredRecord<T> = await fs.readJSON(location)
        if (is_stored_record(result)) {
          if (!this.collection.audit) {
            await fs.writeJSON(location, result)
          }
          return result.data
        } else {
          return result
        }
      }
    } else {
      throw new Error('folder not found')
    }
  }

  async set(key: K, item: T): Promise<T> {
    if (await this.exists) {
      if (this.collection.validator?.(item) ?? true) {
        this._counter++
        // checkif exists
        // берем новый ключ
        const uid = this.keyField
          ? item[this.keyField]
            ? item[this.keyField]
            : key
          : key

        // пишем в файл

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

        await fs.writeJSON(this.set_path(uid), result)
        // вставляем в хранилище
        this.tree.insert(key, this.key_filename(uid))
        return this.collection.audit ? result.data : result
      } else {
        console.log(this.collection.validator?.errors)
        throw new Error('Validation error')
      }
    } else {
      throw new Error('folder not found')
    }
  }

  async update(key: K, item: T): Promise<T> {
    // checkif exists
    if (await this.exists) {
      if (this.collection.validator?.(item) ?? true) {
        // ищем текущее название файла
        const location = this.get_path(this.tree.findFirst(key))
        let result: T = item

        const record = await fs.readJSON(location)
        if (this.collection.audit) {
          let res: T | IStoredRecord<T>
          if (!is_stored_record(record)) {
            res = entity_create(
              item[this.collection.id],
              cloneDeep(item),
              this.collection.validation,
            )
          } else {
            res = entity_update(record, cloneDeep(item))
          }
          result = res.data
          await fs.writeJSON(location, res)
        } else {
          // записываем значение в файл
          await fs.writeJSON(location, result)
        }
        return result
      } else {
        console.log(this.collection.validator?.errors)
        throw new Error('Validation error')
      }
    } else {
      throw new Error('folder not found')
    }
  }

  async delete(key: K): Promise<T> {
    if (await this.exists) {
      const value = this.tree.findFirst(key)
      if (value) {
        const location = this.get_path(value)
        const item = await fs.readJSON(location)
        let result: T
        if (is_stored_record<T>(item)) {
          result = item.data
          const res = entity_delete(item)
          await fs.writeJSON(location, res)
        } else {
          result = item
          await fs.unlink(location)
        }
        this.tree.remove(key)
        return result
      }
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
