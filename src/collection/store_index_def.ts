import { IndexDef, IndexStored } from '../IndexDef'
import { Item } from '../Item'
import Collection from '../collection'
import CollectionMemory from 'src/collection-memory'

export function store_index_def<T extends Item>(
  collection: Collection<T> | CollectionMemory<T>,
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
      ? collection.genCache[input.gen.name]
        ? input.gen.name
        : input.gen.toString()
      : undefined,
  }
}
