import CollectionMemory from '../collection-memory'
import { Item } from './Item'
import { StorageAdapterSync } from './StorageAdapterSync'

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
