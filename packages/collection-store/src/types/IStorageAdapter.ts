import Collection from '../core/Collection'
import { StoredData } from './StoredData'
import { Item } from './Item'

export interface IStorageAdapter<T extends Item> {
  get name(): 'AdapterMemory' | 'AdapterFile'
  restore(name?: string): Promise<StoredData<T>>
  store(name?: string): Promise<void>
  init(collection: Collection<T>): IStorageAdapter<T>
  clone(): IStorageAdapter<T>
}
