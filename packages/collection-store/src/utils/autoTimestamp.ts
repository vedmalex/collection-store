import { Item } from '../types/Item'
import { IList } from '../async/IList'

import { debug } from 'debug'
const log = debug('autoTimestamp')

export function autoTimestamp<T extends Item>(
  item: T,
  model: string,
  list: IList<T>,
) {
  log(arguments)
  return Date.now()
}
