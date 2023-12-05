import { IList } from '../async/IList'

export function autoTimestamp<T>(item: T, model: string, list: IList<T>) {
  return Date.now()
}
