import Collection from '../collection'
import { StoredData } from '../storage/StoredData'
import { Item } from './Item'

export interface StorageAdapter<T extends Item> {
  restore(name?: string): Promise<StoredData<T>>
  store(name?: string): Promise<void>
  init(collection: Collection<T>): StorageAdapter<T>
  clone(): StorageAdapter<T>
}
