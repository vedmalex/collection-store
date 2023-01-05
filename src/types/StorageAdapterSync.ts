import CollectionMemory from '../sync/collection-memory'
import { StoredData } from '../storage/StoredData'
import { Item } from './Item'

export interface StorageAdapterSync<T extends Item> {
  restore(name?: string): StoredData<T>
  store(name?: string): void
  init(collection: CollectionMemory<T>): StorageAdapterSync<T>
  clone(): StorageAdapterSync<T>
}
