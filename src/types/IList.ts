import { ValueType } from 'b-pl-tree'
import { StoredIList } from '../adapters/StoredIList'
import Collection from '../collection'
import { Item } from './Item'

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
