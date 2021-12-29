import { ValueType } from 'b-pl-tree'
import { StoredIList } from '../adapters/StoredIList'
import Collection from '../collection'
import CollectionMemory from '../collection-memory'
import { Item } from '../Item'

export interface IList<T extends Item> {
  readonly forward: AsyncIterable<T>
  readonly backward: AsyncIterable<T>
  get(key: ValueType): Promise<T>
  update(key: ValueType, item: T): Promise<T>
  set(key: ValueType, item: T): Promise<T>
  delete(key: ValueType): Promise<T>
  reset(): Promise<void>
  persist(): StoredIList
  load(obj: StoredIList): IList<T>
  readonly exists: Promise<boolean>
  readonly counter: number
  readonly length: number
  clone(): Promise<IList<T>>
  construct(): IList<T>
  init(collection: Collection<T>): IList<T>
}

export interface IListSync<T extends Item> {
  readonly forward: Iterable<T>
  readonly backward: Iterable<T>
  get(key: ValueType): T
  update(key: ValueType, item: T): T
  set(key: ValueType, item: T): T
  delete(key: ValueType): T
  reset(): void
  persist(): StoredIList
  load(obj: StoredIList): IListSync<T>
  readonly counter: number
  readonly length: number
  clone(): IListSync<T>
  construct(): IListSync<T>
  init(collection: CollectionMemory<T>): IListSync<T>
}
