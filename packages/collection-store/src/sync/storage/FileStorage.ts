import { ValueType, BPlusTree } from 'b-pl-tree'
import { StoredIList } from '../../types/StoredIList'
import { Item } from '../../types/Item'
import fs from 'fs-extra'
import pathlib from 'path'
import { IListSync } from '../IListSync'
import { entity_delete } from '../../utils/entity_delete'
import { entity_update } from '../../utils/entity_update'
import { IStoredRecord } from '../../types/IStoredRecord'
import { entity_create } from '../../utils/entity_create'
import { is_stored_record } from '../../utils/is_stored_record'
import { cloneDeep } from 'lodash'
import CollectionSync from '../collection'

// each data chunk store in its own storage, or file
export class FileStorage<T extends Item, K extends ValueType>
  implements IListSync<T> {
  singlefile: boolean = false
  //  хранить промисы типа кэширование данных к которым был доступ, и которые не обновлялись
  // а на обновление выставлять новый промис
  // таким образом данные всегда будут свежими... если нет другого читателя писателя файлов
  // можно использовать библиотеку для монитроинга за файлами
  tree: BPlusTree<string, K> = new BPlusTree(32, true)
  get folder(): string {
    return this.collection.path
  }
  constructor(private keyField?: string) { }
  exists: boolean
  collection: CollectionSync<T>
  construct() {
    return new FileStorage<T, K>() as IListSync<T>
  }

  init(collection: CollectionSync<T>): IListSync<T> {
    this.collection = collection
    if (this.keyField && !this.collection.indexDefs[this.keyField].unique) {
      throw new Error(`key field ${this.keyField} is not unique`)
    }
    this.exists = true
    fs.ensureDirSync(this.folder)
    return this
  }
  clone(): IListSync<T> {
    const res = new FileStorage<T, K>()
    BPlusTree.deserialize(res.tree, BPlusTree.serialize(this.tree))
    return res
  }
  persist(): StoredIList {
    return {
      keyField: this.keyField,
      counter: this._counter,
      tree: BPlusTree.serialize(this.tree),
    }
  }

  load(obj: StoredIList): IListSync<T> {
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
      [Symbol.iterator]: () => this.toArray(),
    }
  }

  get backward() {
    return {
      [Symbol.iterator]: () => this.toArrayReverse(),
    }
  }

  *toArray() {
    const it = this.tree.each()(this.tree)
    for (const path of it) {
      yield fs.readJSONSync(this.get_path(path.value))
    }
  }

  *toArrayReverse() {
    const it = this.tree.each(false)(this.tree)
    for (const path of it) {
      yield fs.readJSONSync(this.get_path(path.value))
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

  reset() {
    fs.remove(this.folder)
    this.tree.reset()
    fs.ensureDirSync(this.folder)
    this.exists = true
  }

  get(key: K): T {
    const value = this.tree.findFirst(key)
    if (value) {
      const location = this.get_path(value)
      const result: T | IStoredRecord<T> = fs.readJSONSync(location)
      if (is_stored_record(result)) {
        if (!this.collection.audit) {
          fs.writeJSONSync(location, result)
        }
        return result.data
      } else {
        return result
      }
    }
  }

  set(key: K, item: T): T {
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

      fs.writeJSONSync(this.set_path(uid), result)
      // вставляем в хранилище
      this.tree.insert(key, this.key_filename(uid))
      return this.collection.audit ? result.data : result
    } else {
      console.log(this.collection.validator?.errors)
      throw new Error('Validation error')
    }
  }

  update(key: K, item: T): T {
    if (this.collection.validator?.(item) ?? true) {
      // ищем текущее название файла
      const location = this.get_path(this.tree.findFirst(key))
      let result: T = item

      const record = fs.readJSONSync(location)
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
        fs.writeJSONSync(location, res)
      } else {
        // записываем значение в файл
        fs.writeJSONSync(location, result)
      }
      return result
    } else {
      console.log(this.collection.validator?.errors)
      throw new Error('Validation error')
    }
  }

  delete(key: K): T | undefined {
    const value = this.tree.findFirst(key)
    if (value) {
      const location = this.get_path(value)
      const item = fs.readJSONSync(location)
      let result: T
      if (is_stored_record<T>(item)) {
        result = item.data
        const res = entity_delete(item)
        fs.writeJSONSync(location, res)
      } else {
        result = item
        fs.unlinkSync(location)
      }
      this.tree.remove(key)
      return result
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
