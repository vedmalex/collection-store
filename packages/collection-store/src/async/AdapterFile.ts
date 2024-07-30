import pathLib from 'path'
import fs from 'fs-extra'
import { Item } from '../types/Item'
import { IStorageAdapter } from './IStorageAdapter'
import Collection from './collection'

export default class AdapterFile<T extends Item> implements IStorageAdapter<T> {
  get name() {
    return 'AdapterFile' as const
  }
  get file(): string {
    if (this.collection.list.singlefile) {
      return pathLib.join(this.collection.root, `${this.collection.name}.json`)
    }
    return pathLib.join(this.collection.root, this.collection.name, 'metadata.json')
  }
  collection!: Collection<T>
  clone() {
    return new AdapterFile<T>()
  }

  init(collection: Collection<T>) {
    this.collection = collection
    return this
  }

  async restore(name?: string) {
    let path = this.file
    if (name) {
      const p = { ...pathLib.parse(this.file) } as Partial<pathLib.ParsedPath>
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    if (fs.pathExistsSync(path)) {
      return fs.readJSON(path)
    }
    return false
  }

  async store(name: string) {
    let path = this.file
    if (name) {
      const p = { ...pathLib.parse(this.file) } as Partial<pathLib.ParsedPath>
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
