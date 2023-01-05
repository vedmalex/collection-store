import { Paths } from './Paths'
import { Item } from './Item'
import { ValueType } from 'b-pl-tree'
import { TraverseCondition } from 'src/iterators/TraverseCondition'

export interface IDataCollectionSync<T extends Item> {
  reset(): void
  load(name?: string): void
  persist(name?: string): void

  push(item: T): T
  create(item: T): T
  save(update: T): T

  first(): T
  last(): T

  oldest(): T
  latest(): T

  lowest(key: Paths<T>): T
  greatest(key: Paths<T>): T

  find(condition: TraverseCondition<T>): Array<T>

  findFirst(condition: TraverseCondition<T>): T
  findLast(condition: TraverseCondition<T>): T

  findBy(key: Paths<T>, id: ValueType): Array<T>
  findFirstBy(key: Paths<T>, id: ValueType): T
  findLastBy(key: Paths<T>, id: ValueType): T

  findById(id: ValueType): T

  update(condition: TraverseCondition<T>, update: Partial<T>): Array<T>
  updateFirst(condition: TraverseCondition<T>, update: Partial<T>): T
  updateLast(condition: TraverseCondition<T>, update: Partial<T>): T

  updateWithId(id: ValueType, update: Partial<T>): T
  removeWithId(id: ValueType): T

  remove(condition: TraverseCondition<T>): Array<T>
  removeFirst(condition: TraverseCondition<T>): T
  removeLast(condition: TraverseCondition<T>): T
}
