import Collection from './collection'
import { CollectionConfig } from './CollectionConfig'
import { Item } from './Item'
import fs from 'fs-extra'
import pathLib from 'path'
import { StorageAdapter } from './StorageAdapter'

export interface CollectionConfigNode<T> extends CollectionConfig<T> {
  path: string
}

export default class AdapterFile<T extends Item> implements StorageAdapter<T> {
  file: string
  collection: Collection<T>
  clone() {
    return new AdapterFile<T>(this.file)
  }
  constructor(path?: string) {
    this.file = path
  }

  init(collection: Collection<T>) {
    this.collection = collection
    if (!this.file) {
      this.file = `${collection.model}.json`
    }
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
