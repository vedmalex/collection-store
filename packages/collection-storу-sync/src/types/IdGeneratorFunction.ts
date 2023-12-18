import { IList } from '../async/IList'
import { IListSync } from '../sync/IListSync'
import { Item } from './Item'

export type IdGeneratorFunction<T extends Item> = (
  item: T | Partial<T>,
  model: string,
  list: IList<T> | IListSync<T>,
) => any
