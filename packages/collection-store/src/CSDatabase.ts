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

import { debug } from 'debug'
import { IndexDef } from './types/IndexDef'
import AdapterFile from './async/AdapterFile'
import { List } from './async/storage/List'
import { serialize_collection_config } from './async/collection/serialize_collection_config'
import { deserialize_collection_config } from './async/collection/deserialize_collection_config'
const log = debug('CSDatabase')

export interface TransactionOptions {}

export interface CSTransaction {
  startTransaction(options: TransactionOptions): Promise<void>
  abortTransaction(): Promise<void>
  commitTransaction(): Promise<void>
  endSession(): Promise<void>
}

export class CSDatabase implements CSTransaction {
  private root
  private inTransaction: boolean = false
  private collections: Map<string, Collection<any>>

  constructor(root: string) {
    log('constructor', arguments)
    this.root = root
    this.collections = new Map()
  }

  private async writeSchema() {
    log('writeSchema', arguments)
    let result = {} as Record<string, ISerializedCollectionConfig>
    for (let [name, collection] of this.collections) {
      result[name] = serialize_collection_config(collection)
    }
    fse.ensureDir(this.root)
    fs.writeFileSync(
      path.join(this.root, 'index.json'),
      JSON.stringify(result, null, 2),
    )
  }

  async connect() {
    log('connect', arguments)
    await this.load()
  }

  async load() {
    let result = fse.readJSONSync(path.join(this.root, 'index.json')) as Record<
      string,
      ISerializedCollectionConfig
    >

    this.collections.clear()
    for (let name in result) {
      let config = result[name]
      let collection = Collection.create(deserialize_collection_config(config))
      await collection.load()
      this.registerCollection(collection)
    }
  }

  async close() {
    log('close', arguments)
  }

  collectionList: Map<string, ICollectionConfig<any>> = new Map()

  private registerCollection(collection: Collection<any>) {
    log('registerCollection', arguments)
    if (!this.collections.has(collection.name)) {
      this.collections.set(collection.name, collection)
      return
    }
    throw new Error(`collection ${collection.name} already exists`)
  }

  createCollection<T extends Item>(name: string): IDataCollection<T> {
    log('createCollection', arguments)
    const collection = Collection.create({
      name,
      list: new List<T>(),
      adapter: new AdapterFile<T>(),
      root: this.root,
    })

    this.registerCollection(collection)
    this.writeSchema()
    return collection
  }

  listCollections(): Array<IDataCollection<any>> {
    log('listCollections', arguments)
    return [...this.collections.values()]
  }

  dropCollection(name: string): boolean {
    log('dropCollection', arguments)
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
    log('collection', arguments)
    if (this.collections.has(name)) {
      return this.collections.get(name)
    }
    throw new Error(`collection ${name} not found`)
  }

  createIndex(collection: string, name: string, def: IndexDef<any>) {
    log('createIndex', arguments)
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
    log('createIndex', arguments)
    if (this.collections.has(collection)) {
      this.collections.get(collection)?.dropIndex(name)
      this.writeSchema()
      return
    }
    throw new Error(`collection ${collection} not found`)
  }

  async persist() {
    log('persist', arguments)
    const res = []
    for (let collection of this.collections) {
      res.push(collection[1].persist())
    }
    return Promise.all(res)
  }

  async startSession(): Promise<CSTransaction> {
    log('startSession', arguments)
    if (!this.inTransaction) {
      await this.persist()
    }
    return this
  }

  async endSession(): Promise<void> {
    log('endSession', arguments)
    this.inTransaction = false
  }

  async startTransaction(options: TransactionOptions): Promise<void> {
    log('startTransaction', arguments)
    this.inTransaction = true
  }
  async abortTransaction(): Promise<void> {
    log('abortTransaction', arguments)
    this.inTransaction = false
  }
  async commitTransaction(): Promise<void> {
    log('commitTransaction', arguments)
    // проверять какие значения были внесены, что изменилось и создавать транзакцию для изменения
    await this.persist()
    this.inTransaction = false
  }
}
