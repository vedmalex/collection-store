import CollectionMemory from './collection-memory'
import decamelize from 'decamelize'
import { Item } from './Item'
import fs from 'fs-extra'
import pathLib from 'path'
import { StorageAdapter, StorageAdapterSync } from './interfaces/StorageAdapter'

export default class AdapterMemorySync<T extends Item>
  implements StorageAdapterSync<T> {
  collection: CollectionMemory<T>
  clone(): AdapterMemorySync<T> {
    return new AdapterMemorySync<T>()
  }

  init(collection: CollectionMemory<T>): this {
    this.collection = collection
    return this
  }

  restore(name?: string) {
    return {} as any
  }

  store(name: string) {
    return
  }
}
