import { get } from 'lodash-es'
import { IndexDef } from '../types/IndexDef'
import { Item } from '../types/Item'
import { BPlusTree, ValueType } from 'b-pl-tree'
import Collection from '../collection'
import { ensure_indexed_value } from './ensure_indexed_value'
import { get_value } from './get_value'
import { validate_indexed_value_for_insert } from './validate_indexed_value_for_insert'
import { validate_indexed_value_for_update } from './validate_indexed_value_for_update'
import { ensure_indexes } from './ensure_indexes'
import { build_indexes } from './build_indexes'
import { CompositeKeyUtils } from '../utils/CompositeKeyUtils'
import { SingleKeyUtils } from '../utils/SingleKeyUtils'

export function create_index<T extends Item>(
  collection: Collection<T>,
  key: string,
  indexDef: IndexDef<T>,
) {
  const {
    auto = false,
    unique = false,
    sparse = false,
    required = false,
    ignoreCase,
    keys,
    composite,
    order,
  } = indexDef

  let { gen, process } = indexDef

  // Determine if this is a composite index
  const isCompositeIndex = !!(keys || composite)
  const keyPaths = keys || composite?.keys
  const separator = composite?.separator || CompositeKeyUtils.DEFAULT_SEPARATOR
  let compositeDef = composite

  if (auto && !gen) {
    gen = Collection.genCache['autoIncIdGen']
  }

  if (ignoreCase) {
    process = (value: any) =>
      value?.toString ? value.toString().toLowerCase() : value
  }

  // Validate index configuration
  if (isCompositeIndex) {
    if (!keyPaths) {
      throw new Error(`Composite key paths are required for composite index`)
    }

    // Normalize composite keys to support sort order
    const normalizedFields = CompositeKeyUtils.normalizeCompositeKeys(keyPaths)

    // Validate normalized fields
    if (!CompositeKeyUtils.validateCompositeKeyFields(normalizedFields)) {
      throw new Error(`Invalid composite key fields for index`)
    }

    // Generate index name from key paths if not provided
    if (!key) {
      key = CompositeKeyUtils.generateIndexNameFromFields(normalizedFields)
    }

    // Override process function for composite keys with sort order support
    process = (item: T) => {
      return CompositeKeyUtils.createKeyWithOrder(item, normalizedFields, separator)
    }

    // Store normalized fields in composite definition
    compositeDef = { keys: normalizedFields as any, separator }
  } else {
    if (!key) {
      throw new Error(`key is required field for index`)
    }
  }

  collection.indexDefs[key] = {
    key: isCompositeIndex ? undefined : (indexDef.key || key),
    keys: isCompositeIndex ? (keys || undefined) : undefined, // Use original keys for legacy support
    composite: isCompositeIndex ? compositeDef : undefined,
    order: !isCompositeIndex ? order : undefined, // Sort order for single keys only
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

  const insert: any =
    key !== '*'
      ? (item: T) => {
          const value = ensure_indexed_value(
            item,
            key,
            collection,
            gen,
            auto,
            process,
          )
          const [valid, message] = validate_indexed_value_for_insert(
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
        }
      : (item: T) => {
          let found = false
          const newIndexDefs = Object.keys(item).reduce((res, pname) => {
            if (!collection.indexDefs[pname]) {
              found = true
              res[pname] = {
                ...collection.indexDefs['*'],
                key: pname,
              }
            }
            return res
          }, {} as Record<string, IndexDef<T>>)

          if (found) {
            collection.indexDefs = {
              ...collection.indexDefs,
              ...newIndexDefs,
            }
            build_indexes(collection, newIndexDefs)
            ensure_indexes(collection)
          }
          return (record_link: ValueType) => undefined
        }

  const update: any =
    key !== '*'
      ? async (ov: T | Partial<T>, nv: T | Partial<T>, index_payload: number) => {
          const valueOld = ensure_indexed_value<T>(
            ov,
            key,
            collection,
            gen,
            auto,
            process,
          )
          const valueNew = get_value(nv, key, process)
          if (valueNew != null) {
            const [valid, message] = await validate_indexed_value_for_update(
              collection,
              valueNew,
              key,
              sparse,
              required,
              unique,
              (ov as any)[collection.id],
            )
            if (!valid) throw new Error(message)
            if (valueOld !== valueNew) {
              if (unique) {
                collection.indexes[key].remove(valueOld)
              } else {
                collection.indexes[key].removeSpecific(valueOld, (pointer) =>
                  key != collection.id ? pointer == (ov as any)[collection.id] : true,
                )
              }
              collection.indexes[key].insert(
                valueNew !== undefined ? valueNew : null,
                index_payload,
              )
            }
          } else {
            if (unique) {
              collection.indexes[key].remove(valueOld)
            } else {
              collection.indexes[key].removeSpecific(valueOld, (pointer) =>
                key != collection.id ? pointer == (ov as any)[collection.id] : true,
              )
            }
          }
        }
      : undefined

  const remove: any =
    key !== '*'
      ? (item: T) => {
          let value: any
          if (isCompositeIndex && process) {
            // For composite indexes, pass the entire item to process function
            value = process(item)
          } else {
            // For single key indexes, get the field value first
            value = get(item, key) ?? null
            // Then apply process to the value if it exists
            if (process && !isCompositeIndex) {
              value = process(value)
            }
          }
          collection.indexes[key].removeSpecific(
            value,
            (pointer) =>
              key != collection.id ? pointer == item[collection.id] : true,
          )
        }
      : undefined

  const ensure =
    key !== '*'
      ? () => {
          if (!collection.indexes.hasOwnProperty(key)) {
            // Create comparator for single keys with sort order support
            const comparator = !isCompositeIndex && order
              ? SingleKeyUtils.createComparator(order)
              : undefined
            collection.indexes[key] = new BPlusTree<any, number>(undefined, unique, comparator)
          }
        }
      : undefined

  const rebuild =
    key !== '*'
      ? async () => {
          if (!collection.indexes.hasOwnProperty(key)) {
            // Create comparator for single keys with sort order support
            const comparator = !isCompositeIndex && order
              ? SingleKeyUtils.createComparator(order)
              : undefined
            collection.indexes[key] = new BPlusTree<any, number>(undefined, unique, comparator)
            if (collection.list.length > 0) {
              for await (const item of collection.list.forward) {
                insert?.(item)?.(item[collection.id])
              }
            }
          }
        }
      : null

  if (ensure) collection.ensures.push(ensure)
  if (rebuild) collection.rebuilds.push(rebuild)
  if (insert) collection.inserts.push(insert)
  if (update) collection.updates.push(update)
  if (remove) collection.removes.push(remove)
}
