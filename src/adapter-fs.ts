import Collection from './collection'
import { CollectionConfig } from './CollectionConfig'
import { Item } from './Item'
import fs from 'fs-extra'
import pathLib from 'path'
import { StorageAdapter } from './interfaces/StorageAdapter'

export default class AdapterFS<T extends Item> implements StorageAdapter<T> {
  get file(): string {
    return pathLib.join(this.collection.model, 'metadata.json')
  }
  collection: Collection<T>
  clone() {
    return new AdapterFS<T>()
  }

  init(collection: Collection<T>) {
    this.collection = collection
    return this
  }

  async restore(name?: string) {
    let path = this.file
    if (name) {
      let p = pathLib.parse(this.file)
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
      let p = pathLib.parse(this.file)
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
