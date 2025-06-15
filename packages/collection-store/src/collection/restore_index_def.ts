import { Item } from '../types/Item'
import { IndexDef } from '../types/IndexDef'
import { IndexStored } from '../types/IndexStored'
import Collection from '../core/Collection'

export function restore_index_def<T extends Item>(
  collection: Collection<T>,
  input: IndexStored<T>,
): IndexDef<T> {
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
      ? eval(input.process)
      : undefined,
    gen: input.gen
      ? Collection.genCache[input.gen]
        ? Collection.genCache[input.gen]
        : eval(input.gen)
      : undefined,
  }
}
