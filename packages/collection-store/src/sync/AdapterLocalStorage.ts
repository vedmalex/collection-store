import { StoredData } from '../types/StoredData'
import { Item } from '../types/Item'
import { IStorageAdapterSync } from './IStorageAdapterSync'
import CollectionSync from './collection'

export default class AdapterLocalStorage<T extends Item>
  implements IStorageAdapterSync<T>
{
  storage: Storage
  collection: CollectionSync<T>

  clone() {
    return new AdapterLocalStorage<T>(this.storage)
  }
  constructor(storage?: Storage) {
    this.storage = storage || localStorage
  }
  init(collection: CollectionSync<T>): IStorageAdapterSync<T> {
    this.collection = collection
    return this
  }
  restore(name?: string): StoredData<T> {
    return JSON.parse(this.storage.getItem(name ?? this.collection.model))
  }
  store(name?: string) {
    this.storage.setItem(
      this.collection.model,
      JSON.stringify(name ?? this.collection.store()),
    )
  }
}
