import { ValueType } from 'b-pl-tree'
import { StoredIList } from '../types/StoredIList'
import CollectionMemory from './CollectionMemory'
import { Item } from '../types/Item'

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
