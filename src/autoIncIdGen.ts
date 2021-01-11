import { List } from './List'

export function autoIncIdGen<T>(item: T, model: string, list: List<T>) {
  return list.counter
}
