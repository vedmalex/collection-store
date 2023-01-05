import CollectionMemory from './CollectionMemory'
import { StoredData } from '../types/StoredData'
import { Item } from '../types/Item'

export interface IStorageAdapterSync<T extends Item> {
  restore(name?: string): StoredData<T>
  store(name?: string): void
  init(collection: CollectionMemory<T>): IStorageAdapterSync<T>
  clone(): IStorageAdapterSync<T>
}
