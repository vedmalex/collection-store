import { get } from 'lodash'
import { IndexDef } from '../IndexDef'
import { Item } from '../Item'
import { Dictionary } from '../hash'
import { BPlusTree, ValueType } from 'b-pl-tree'
import Collection from '../collection'
import { ensure_indexed_value } from './ensure_indexed_value'
import { get_value } from './get_value'
import { validate_indexed_value } from './validate_indexed_value'

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

    collection.ensures.push(() => {
      if (!collection.indexes.hasOwnProperty(key)) {
        collection.indexes[key] = new BPlusTree<any, number>()
      }
    })

    collection.inserts.push((item) => {
      let value = ensure_indexed_value(
        item,
        key,
        collection,
        gen,
        auto,
        process,
      )
      const [valid, message] = validate_indexed_value(
        collection,
        value,
        key,
        sparse,
        required,
        unique,
      )
      if (!valid) throw new Error(message)
      if (!(sparse && value == null)) {
        return (record_link: ValueType) =>
          collection.indexes[key].insert(
            value !== undefined ? value : null,
            record_link,
          )
      }
    })

    collection.updates.push((ov, nv, index_payload: number) => {
      let valueOld = ensure_indexed_value(
        ov,
        key,
        collection,
        gen,
        auto,
        process,
      )
      let valueNew = get_value(nv, key, process)
      if (valueNew != null) {
        const [valid, message] = validate_indexed_value(
          collection,
          valueNew,
          key,
          sparse,
          required,
          unique,
        )
        if (!valid) throw new Error(message)
        if (valueOld !== valueNew) {
          collection.indexes[key].remove(valueOld)
          collection.indexes[key].insert(
            valueNew !== undefined ? valueNew : null,
            index_payload,
          )
        }
      } else {
        collection.indexes[key].remove(valueOld)
      }
    })

    collection.removes.push((item) => {
      collection.indexes[key].remove(get(item, key))
    })
  }
}
