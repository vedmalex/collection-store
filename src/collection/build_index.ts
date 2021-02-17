import { get, set } from 'lodash'
import { IndexDef } from '../IndexDef'
import { Item } from '../Item'
import { Dictionary } from '../hash'
import { BPlusTree } from 'b-pl-tree'
import Collection from '../collection'

export function build_index<T extends Item>(
  collection: Collection<T>,
  indexList: Dictionary<IndexDef<T>>,
) {
  for (let key in indexList) {
    let {
      auto = false,
      unique = false,
      gen,
      sparse = false,
      required = false,
      ignoreCase,
      process,
    } = indexList[key]

    if (auto && !gen) {
      gen = collection.genCache['autoIncIdGen']
    }
    if (ignoreCase) {
      process = (value: any) =>
        value?.toString ? value.toString().toLowerCase() : value
    }

    if (!key) {
      throw new Error(`key is required field for index`)
    }

    collection.indexDefs[key] = {
      key,
      auto,
      unique,
      gen,
      sparse,
      required,
      ignoreCase,
      process,
    }

    if (collection.indexes.hasOwnProperty(key)) {
      throw new Error(`index with key ${key} already exists`)
    }

    let validate = (value) => {
      if (!(sparse && value == null)) {
        if (required && value == null) {
          throw new Error(
            `value for index ${key} is required, but ${value} is met`,
          )
        }
        if (
          unique &&
          collection.indexes.hasOwnProperty(key) &&
          collection.indexes[key].find(value).length > 0
        ) {
          throw new Error(`unique index ${key} already contains value ${value}`)
        }
      }
    }

    let ensureValue = (item: T) => {
      let value = get(item, key)
      if (value == null && auto) {
        set(item, key, (value = gen(item, collection.model, collection.list)))
      }
      if (process) {
        value = process(value)
      }
      return value
    }

    let getValue = (item) => {
      let value = get(item, key)
      if (process) {
        value = process(value)
      }
      return value
    }

    collection.ensures.push(() => {
      if (!collection.indexes.hasOwnProperty(key)) {
        collection.indexes[key] = new BPlusTree<any, number>()
      }
    })

    collection.inserts.push((item) => {
      let value = ensureValue(item)
      validate(value)
      if (!(sparse && value == null)) {
        return (i) =>
          collection.indexes[key].insert(value !== undefined ? value : null, i)
      }
    })

    collection.updates.push((ov, nv, i: number) => {
      let valueOld = ensureValue(ov)
      let valueNew = getValue(nv)
      if (valueNew != null) {
        validate(valueNew)
        if (valueOld !== valueNew) {
          collection.indexes[key].remove(valueOld)
          collection.indexes[key].insert(
            valueNew !== undefined ? valueNew : null,
            i,
          )
        }
      } else {
        collection.indexes[key].remove(valueOld)
      }
    })

    collection.removes.push((item, i) => {
      collection.indexes[key].remove(get(item, key))
    })
  }
}
