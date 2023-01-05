import { StoredData } from '../types/StoredData'
import { Item } from '../types/Item'
import { IStorageAdapterSync } from './IStorageAdapterSync'
import decamelize from 'decamelize'
import CollectionMemory from './CollectionMemory'

export default class AdapterLocalStorage<T extends Item>
  implements IStorageAdapterSync<T> {
  storage: Storage
  collection: CollectionMemory<T>

  clone() {
    return new AdapterLocalStorage<T>(this.storage)
  }
  constructor(storage?: Storage) {
    this.storage = storage || localStorage
  }
  init(collection: CollectionMemory<T>): IStorageAdapterSync<T> {
    this.collection = collection
    return this
  }
  restore(name?: string): StoredData<T> {
    return JSON.parse(
      this.storage.getItem(name ?? decamelize(this.collection.model)),
    )
  }
  store(name?: string): Promise<void> {
    return new Promise((res, rej) => {
      try {
        res()
        this.storage.setItem(
          decamelize(this.collection.model),
          JSON.stringify(name ?? this.collection.store()),
        )
      } catch (e) {
        rej(e)
      }
    })
  }
}
