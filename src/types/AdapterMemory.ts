import Collection from '../collection'
import { Item } from './Item'
import { StorageAdapter } from './StorageAdapter'

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

  restore(name?: string): Promise<any> {
    return Promise.resolve({})
  }

  store(name: string) {
    return Promise.resolve()
  }
}
