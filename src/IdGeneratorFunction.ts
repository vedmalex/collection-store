import { IList } from './interfaces/IList'
import { Item } from './Item'

export type IdGeneratorFunction<T extends Item> = (
  item: T,
  model: string,
  list: IList<T>,
) => any
