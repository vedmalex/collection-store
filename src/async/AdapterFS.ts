import Collection from './collection'
import { ICollectionConfig } from './ICollectionConfig'
import { Item } from '../types/Item'
import fs from 'fs-extra'
import pathLib from 'path'
import { IStorageAdapter } from './IStorageAdapter'
import decamelize from 'decamelize'

export default class AdapterFS<T extends Item> implements IStorageAdapter<T> {
  path: string
  get file(): string {
    return this.path
      ? pathLib.join(
          this.path,
          // decamelize(this.collection.model),
          'metadata.json',
        )
      : pathLib.join(decamelize(this.collection.model), 'metadata.json')
  }
  collection: Collection<T>
  constructor(path?: string) {
    this.path = path
  }
  clone() {
    return new AdapterFS<T>(this.path)
  }

  init(collection: Collection<T>) {
    this.collection = collection
    if (!this.path) {
      this.path = this.collection.path
    }
    return this
  }

  async restore(name?: string) {
    let path = this.file
    if (name) {
      const p = pathLib.parse(this.file)
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    await fs.ensureFile(path)
    return fs.readJSON(path)
  }

  async store(name: string) {
    let path = this.file
    if (name) {
      const p = pathLib.parse(this.file)
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    await fs.ensureFile(path)
    await fs.writeJSON(path, this.collection.store(), {
      spaces: 2,
    })
  }
}
