import Collection from './collection'
import decamelize from 'decamelize'
import { Item } from './Item'
import fs from 'fs-extra'
import pathLib from 'path'
import { StorageAdapter } from './interfaces/StorageAdapter'

export default class AdapterMemory<T extends Item>
  implements StorageAdapter<T> {
  collection: Collection<T>
  clone(): AdapterMemory<T> {
    return new AdapterMemory<T>()
  }

  init(collection: Collection<T>): this {
    this.collection = collection
    return this
  }

  async restore(name?: string): Promise<any> {
    return Promise.resolve({})
  }

  async store(name: string) {
    return Promise.resolve()
  }
}
