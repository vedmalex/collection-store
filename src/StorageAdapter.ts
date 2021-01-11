import Collection from './collection'
import { StoredData } from './StoredData'

export interface StorageAdapter<T> {
  restore(name?: string): Promise<StoredData<T>>
  store(name?: string): Promise<void>
  init(collection: Collection<T>): StorageAdapter<T>
  clone(): StorageAdapter<T>
}
