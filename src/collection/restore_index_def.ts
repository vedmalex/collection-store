import { IndexDef, IndexStored } from '../IndexDef'

export function restore_index_def<T>(input: IndexStored<T>): IndexDef<T> {
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
      ? eval(input.process)
      : undefined,
    gen: input.gen
      ? this.genCache[input.gen]
        ? this.genCache[input.gen]
        : eval(input.gen)
      : undefined,
  }
}
