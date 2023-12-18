import { IndexDef } from '../../types/IndexDef'
import { Item } from '../../types/Item'
import { Dictionary } from '../../types/Dictionary'
import Collection from '../collection'
import { create_index } from './create_index'

export function build_indexes<T extends Item>(
  collection: Collection<T>,
  indexList: Dictionary<IndexDef<T>>,
): void {
  for (const key in indexList) {
    create_index<T>(collection, key, indexList[key])
  }
}
