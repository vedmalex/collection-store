import { ValueType } from 'b-pl-tree'

export type ProcessInsert<T> = (item: T) => (index_payload: ValueType) => void
