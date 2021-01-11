import Collection from './collection'
import { CollectionConfig } from './CollectionConfig'
import { StoredData } from './StoredData'
import { Item } from './Item'
import { StorageAdapter } from './StorageAdapter'

export interface CollectionConfigWeb<T> extends CollectionConfig<T> {
  storage: Storage
}

export default class AdapterLocalStorage<T extends Item>
  implements StorageAdapter<T> {
  storage: Storage
  collection: Collection<T>

  clone() {
    return new AdapterLocalStorage<T>(this.storage)
  }
  constructor(storage?: Storage) {
    this.storage = storage || localStorage
  }
  init(collection: Collection<T>): StorageAdapter<T> {
    this.collection = collection
    return this
  }
  restore(name?: string): Promise<StoredData<T>> {
    return new Promise((res, rej) => {
      res(JSON.parse(this.storage.getItem(name ?? this.collection.model)))
    })
  }
  store(name?: string): Promise<void> {
    return new Promise((res, rej) => {
      try {
        res()
        this.storage.setItem(
          this.collection.model,
          JSON.stringify(name ?? this.collection.store()),
        )
      } catch (e) {
        rej(e)
      }
    })
  }
}
