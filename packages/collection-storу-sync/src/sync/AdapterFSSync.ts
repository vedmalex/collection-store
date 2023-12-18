import Collection from './collection'
import { Item } from '../types/Item'
import fs from 'fs-extra'
import pathLib from 'path'
import { IStorageAdapterSync } from './IStorageAdapterSync'

export default class AdapterSyncFS<T extends Item>
  implements IStorageAdapterSync<T>
{
  get file(): string {
    if (this.collection.list.singlefile) {
      return pathLib.join(this.collection.root, `${this.collection.model}.json`)
    } else {
      return pathLib.join(
        this.collection.root,
        this.collection.model,
        'metadata.json',
      )
    }
  }
  collection: Collection<T>
  clone() {
    return new AdapterSyncFS<T>()
  }

  init(collection: Collection<T>) {
    this.collection = collection
    return this
  }

  restore(name?: string) {
    let path = this.file
    if (name) {
      const p = pathLib.parse(this.file)
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    fs.ensureFileSync(path)
    return fs.readJSONSync(path)
  }

  store(name: string) {
    let path = this.file
    if (name) {
      const p = pathLib.parse(this.file)
      p.name = name
      delete p.base
      path = pathLib.format(p)
    }
    fs.ensureFileSync(path)

    fs.writeJSONSync(path, this.collection.store(), {
      spaces: 2,
    })
  }
}
