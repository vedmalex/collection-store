import Collection from './collection'
import { StoredData } from './types/StoredData'
import { Item } from './types/Item'

export interface IStorageAdapter<T extends Item> {
  get name(): 'AdapterMemory' | 'AdapterFile'
  restore(name?: string): Promise<StoredData<T>>
  store(name?: string): Promise<void>
  init(collection: Collection<T>): IStorageAdapter<T>
  clone(): IStorageAdapter<T>
}
