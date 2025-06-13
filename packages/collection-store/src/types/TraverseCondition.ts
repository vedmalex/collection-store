import { QueryType } from '../query/QueryType'

export type TraverseCondition<T> =
  | QueryType
  | ((arg: T) => boolean)
