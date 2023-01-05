import { Paths } from './Paths'
import { Item } from './Item'
import { ValueType } from 'b-pl-tree'
import { TraverseCondition } from 'src/iterators/TraverseCondition'

export interface IDataCollection<T extends Item> {
  reset(): Promise<void>
  load(name?: string): Promise<void>
  persist(name?: string): Promise<void>

  push(item: T): Promise<T>
  create(item: T): Promise<T>
  save(update: T): Promise<T>

  first(): Promise<T>
  last(): Promise<T>

  oldest(): Promise<T>
  latest(): Promise<T>

  lowest(key: Paths<T>): Promise<T>
  greatest(key: Paths<T>): Promise<T>

  find(condition: TraverseCondition<T>): Promise<Array<T>>

  findFirst(condition: TraverseCondition<T>): Promise<T>
  findLast(condition: TraverseCondition<T>): Promise<T>

  findBy(key: Paths<T>, id: ValueType): Promise<Array<T>>
  findFirstBy(key: Paths<T>, id: ValueType): Promise<T>
  findLastBy(key: Paths<T>, id: ValueType): Promise<T>

  findById(id: ValueType): Promise<T>

  update(condition: TraverseCondition<T>, update: Partial<T>): Promise<Array<T>>
  updateFirst(condition: TraverseCondition<T>, update: Partial<T>): Promise<T>
  updateLast(condition: TraverseCondition<T>, update: Partial<T>): Promise<T>

  updateWithId(id: ValueType, update: Partial<T>): Promise<T>
  removeWithId(id: ValueType): Promise<T>

  remove(condition: TraverseCondition<T>): Promise<Array<T>>
  removeFirst(condition: TraverseCondition<T>): Promise<T>
  removeLast(condition: TraverseCondition<T>): Promise<T>
}
