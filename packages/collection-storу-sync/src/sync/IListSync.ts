import { ValueType } from 'b-pl-tree'
import { StoredIList } from '../types/StoredIList'
import CollectionSync from './collection'
import { Item } from '../types/Item'

export interface IListSync<T extends Item> {
  singlefile: boolean
  readonly forward: Iterable<T>
  readonly backward: Iterable<T>
  get(key: ValueType): T
  update(key: ValueType, item: T): T
  set(key: ValueType, item: T): T
  delete(key: ValueType): T | undefined
  reset(): void
  persist(): StoredIList
  load(obj: StoredIList): IListSync<T>
  readonly counter: number
  readonly length: number
  clone(): IListSync<T>
  construct(): IListSync<T>
  init(collection: CollectionSync<T>): IListSync<T>
}
