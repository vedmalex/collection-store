import { ValueType } from 'b-pl-tree'
import { StoredIList } from './StoredIList'
import Collection from '../core/Collection'
import { Item } from './Item'

export interface IList<T extends Item> {
  get name():  "List" | "FileStorage"
  singlefile: boolean
  readonly forward: AsyncIterable<T>
  readonly backward: AsyncIterable<T>
  get(key: ValueType): Promise<T | undefined>
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
