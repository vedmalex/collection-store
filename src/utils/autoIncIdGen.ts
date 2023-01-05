import { IList } from '../types/IList'

export function autoIncIdGen<T>(item: T, model: string, list: IList<T>) {
  return list.counter
}
