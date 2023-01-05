import { IndexDef } from '../../types/IndexDef'
import { IndexStored } from 'src/types/IndexStored'
import Collection from '../Collection'

export function restore_index_def<T>(
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
      ? collection.genCache[input.gen]
        ? collection.genCache[input.gen]
        : eval(input.gen)
      : undefined,
  }
}
