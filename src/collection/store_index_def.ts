import { IndexDef, IndexStored } from '../IndexDef'
import { Item } from '../Item'

export function store_index_def<T extends Item>(
  input: IndexDef<T>,
): IndexStored<T> {
  let { key, auto, unique, sparse, required, ignoreCase } = input
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
      ? this.genCache[input.gen.name]
        ? input.gen.name
        : input.gen.toString()
      : undefined,
  }
}
