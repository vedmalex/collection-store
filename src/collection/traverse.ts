import { Item } from '../Item'
import Collection from '../collection'
import { query } from '../filter'
import CollectionMemory from '../collection-memory'

export type TraverseCondition<T extends Item> =
  | { [key: string]: unknown }
  | ((arg: T) => boolean)

// возможно не работает TTL не удаляются значения индекса.
export async function* all<T extends Item>(
  collection: Collection<T>,
  condition: TraverseCondition<T>,
): AsyncGenerator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for await (const current of collection.list.forward) {
    if (condition(current)) {
      yield current
    }
  }
}

export function* all_sync<T extends Item>(
  collection: CollectionMemory<T>,
  condition: TraverseCondition<T>,
): Generator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for (const current of collection.list.forward) {
    if (condition(current)) {
      yield current
    }
  }
}

export async function* first<T extends Item>(
  collection: Collection<T>,
  condition: TraverseCondition<T>,
): AsyncGenerator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for await (const current of collection.list.forward) {
    if (condition(current)) {
      yield current
      return
    }
  }
}

export function* first_sync<T extends Item>(
  collection: CollectionMemory<T>,
  condition: TraverseCondition<T>,
): Generator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for (const current of collection.list.forward) {
    if (condition(current)) {
      yield current
      return
    }
  }
}

export async function* last<T extends Item>(
  collection: Collection<T>,
  condition: TraverseCondition<T>,
): AsyncGenerator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for await (const current of collection.list.backward) {
    if (condition(current)) {
      yield current
      return
    }
  }
}

export function* last_sync<T extends Item>(
  collection: CollectionMemory<T>,
  condition: TraverseCondition<T>,
): Generator<T> {
  if (typeof condition == 'object') condition = query(condition)
  for (const current of collection.list.backward) {
    if (condition(current)) {
      yield current
      return
    }
  }
}
