import fse from 'fs-extra/esm'
import fs from 'fs'
import {
  ICollectionConfig,
  ISerializedCollectionConfig,
} from './async/ICollectionConfig'
import { IDataCollection } from './async/IDataCollection'
import { Item } from './types/Item'
import path from 'path'
import Collection from './async/collection'

import { IndexDef } from './types/IndexDef'
import AdapterFile from './async/AdapterFile'
import { List } from './async/storage/List'
import { serialize_collection_config } from './async/collection/serialize_collection_config'
import { deserialize_collection_config } from './async/collection/deserialize_collection_config'
import { FileStorage } from './async/storage/FileStorage'

export interface TransactionOptions {}

export interface CSTransaction {
  startTransaction(options: TransactionOptions): Promise<void>
  abortTransaction(): Promise<void>
  commitTransaction(): Promise<void>
  endSession(): Promise<void>
}

export class CSDatabase implements CSTransaction {
  private root: string
  private name: string
  private inTransaction: boolean = false
  private collections: Map<string, Collection<any>>

  constructor(root: string, name?: string) {
    this.root = root
    this.name = name || 'default'
    this.collections = new Map()
  }

  private async writeSchema() {
    let result = {} as Record<string, ISerializedCollectionConfig>
    for (let [name, collection] of this.collections) {
      result[name] = serialize_collection_config(collection)
    }
    fse.ensureDir(this.root)
    fs.writeFileSync(
      path.join(this.root, `${this.name}.json`),
      JSON.stringify(result, null, 2),
    )
  }

  async connect() {
    await this.load()
  }

  async load() {
    const exists = fs.existsSync(path.join(this.root, `${this.name}.json`))
    if (!exists) {
      fse.ensureDirSync(this.root)
    } else {
      let result = fse.readJSONSync(
        path.join(this.root, `${this.name}.json`),
      ) as Record<string, ISerializedCollectionConfig>

      this.collections.clear()
      for (let name in result) {
        let config = result[name]
        let collection = Collection.create(
          deserialize_collection_config(config),
        )
        await collection.load()
        this.registerCollection(collection)
      }
    }
  }

  async close() {}

  collectionList: Map<string, ICollectionConfig<any>> = new Map()

  private registerCollection(collection: Collection<any>) {
    if (!this.collections.has(collection.name)) {
      this.collections.set(collection.name, collection)
      return
    }
    throw new Error(`collection ${collection.name} already exists`)
  }

  createCollection<T extends Item>(name: string): IDataCollection<T> {
    const [collectionName, collectionType = "List"] = name.split(':')
    const collection = Collection.create({
      name:collectionName,
      list: collectionType === "List" ? new List<T>() : new FileStorage<T>(),
      adapter: new AdapterFile<T>(),
      root: path.join(this.root, this.name),
    })

    this.registerCollection(collection)
    this.writeSchema()
    return collection
  }

  listCollections(): Array<IDataCollection<any>> {
    return [...this.collections.values()]
  }

  dropCollection(name: string): boolean {
    let result = false
    if (this.collections.has(name)) {
      const collection = this.collections.get(name)!
      collection.reset()
      result = this.collections.delete(name)
      this.writeSchema()
    }
    return result
  }

  collection<T extends Item>(name: string): IDataCollection<T> | undefined {
    if (this.collections.has(name)) {
      return this.collections.get(name)
    }
    throw new Error(`collection ${name} not found`)
  }

  createIndex(collection: string, name: string, def: IndexDef<any>) {
    if (this.collections.has(collection)) {
      const col = this.collections.get(collection)!
      if (col.listIndexes(name)) {
        col.dropIndex(name)
        col.createIndex(name, def)
      }
      this.writeSchema()
      return
    }
    throw new Error(`collection ${collection} not found`)
  }

  dropIndex(collection: string, name: string) {
    if (this.collections.has(collection)) {
      this.collections.get(collection)?.dropIndex(name)
      this.writeSchema()
      return
    }
    throw new Error(`collection ${collection} not found`)
  }

  async persist() {
    const res = []
    for (let collection of this.collections) {
      res.push(collection[1].persist())
    }
    return Promise.all(res)
  }

  async startSession(): Promise<CSTransaction> {
    if (!this.inTransaction) {
      await this.persist()
    }
    return this
  }

  async endSession(): Promise<void> {
    this.inTransaction = false
  }

  async startTransaction(options: TransactionOptions): Promise<void> {
    this.inTransaction = true
  }
  async abortTransaction(): Promise<void> {
    this.inTransaction = false
  }
  async commitTransaction(): Promise<void> {
    // проверять какие значения были внесены, что изменилось и создавать транзакцию для изменения
    await this.persist()
    this.inTransaction = false
  }
  // extra operations

  async first(collection: string): Promise<any> {
    return this.collections.get(collection)!.first()
  }
  async last(collection: string): Promise<any> {
    return this.collections.get(collection)!.last()
  }

  async lowest(collection: string, key: string): Promise<any> {
    return this.collections.get(collection)!.lowest(key)
  }
  async greatest(collection: string, key: string): Promise<any> {
    return this.collections.get(collection)!.greatest(key)
  }

  async oldest(collection: string): Promise<any> {
    return this.collections.get(collection)!.oldest()
  }
  async latest(collection: string): Promise<any> {
    return this.collections.get(collection)!.latest()
  }
  async findById(collection: string, id: any) {
    return this.collections.get(collection)!.findById(id)
  }
  async findBy(collection: string, key: string, id: any) {
    return this.collections.get(collection)!.findBy(key, id)
  }
  async findFirstBy(collection: string, key: string, id: any) {
    return this.collections.get(collection)!.findFirstBy(key, id)
  }
  async findLastBy(collection: string, key: string, id: any) {
    return this.collections.get(collection)!.findLastBy(key, id)
  }
}
