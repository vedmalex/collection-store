import { Item } from '../../types/Item'

export type TraverseCondition<T extends Item> =
  | { [key: string]: unknown }
  | ((arg: T) => boolean)
