import { IList } from '../IList'
import { Item } from './Item'

export type IdGeneratorFunction<T extends Item> = (
  item: T | Partial<T>,
  model: string,
  list: IList<T>,
) => any
