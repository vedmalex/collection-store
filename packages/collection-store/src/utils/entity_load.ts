import { Item } from '../types/Item'
import { IStoredRecord } from '../types/IStoredRecord'

export function entity_load<T extends Item>(
  entity: IStoredRecord<T>,
): IStoredRecord<T> {
  return {
    ...entity,
  }
}
