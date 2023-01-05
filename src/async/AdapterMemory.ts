import Collection from './Collection'
import { Item } from '../types/Item'
import { IStorageAdapter } from './IStorageAdapter'

export default class AdapterMemory<T extends Item>
  implements IStorageAdapter<T> {
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
