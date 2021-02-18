export interface StoredList<T> {
  // hash: { [key: string]: T }
  _counter: number
  _count: number
  [key: string]: any
}
