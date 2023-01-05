import CollectionMemory from './CollectionMemory'
import { Item } from '../types/Item'
import { IStorageAdapterSync } from './IStorageAdapterSync'

export default class AdapterMemorySync<T extends Item>
  implements IStorageAdapterSync<T> {
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
