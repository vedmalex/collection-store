import { Item } from './Item'

export type TraverseCondition<T extends Item> =
  | { [key: string]: unknown }
  | ((arg: T) => boolean)
