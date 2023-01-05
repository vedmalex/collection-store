import { IList } from './IList'
import { IListSync } from './IListSync'
import { Item } from './Item'

export type IdGeneratorFunction<T extends Item> = (
  item: T,
  model: string,
  list: IList<T> | IListSync<T>,
) => any
