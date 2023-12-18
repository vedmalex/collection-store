import { Item } from '../types/Item'
import { IList } from '../async/IList'

import { debug } from 'debug'
const log = debug('autoIncIdGen')

export function autoIncIdGen<T extends Item>(
  item: T,
  model: string,
  list: IList<T>,
) {
  log(arguments)
  return list.counter
}
