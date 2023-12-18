import { IndexDef } from '../../types/IndexDef'
import { IndexStored } from '../../types/IndexStored'
import { Item } from '../../types/Item'
import Collection from '../collection'

export function store_index_def<T extends Item>(
  collection: Collection<T>,
  input: IndexDef<T>,
): IndexStored<T> {
  const { key, auto, unique, sparse, required, ignoreCase } = input
  return {
    key,
    auto,
    unique,
    sparse,
    required,
    ignoreCase,
    process: ignoreCase
      ? undefined
      : input.process
      ? input.process.toString()
      : undefined,
    gen: input.gen
      ? Collection.genCache[input.gen.name]
        ? input.gen.name
        : input.gen.toString()
      : undefined,
  }
}
