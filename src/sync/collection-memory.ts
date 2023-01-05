// import fs from 'fs-extra';
import tp from 'timeparse'
import _ from 'lodash'
import { autoIncIdGen } from '../utils/autoIncIdGen'
import { autoTimestamp } from '../utils/autoTimestamp'
import { StorageAdapterSync } from '../types/StorageAdapterSync'
import { IListSync } from '../types/IListSync'
import { IndexDef } from '../types/IndexDef'
import { IndexStored } from '../types/IndexStored'
import { Paths } from '../types/Paths'
import { Item } from '../types/Item'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import { IdType } from '../types/IdType'
import { CollectionConfigSync } from '../types/CollectionConfigSync'
import { CronJob } from 'cron'
import { Dictionary } from '../types/Dictionary'
import { BPlusTree, ValueType } from 'b-pl-tree'
import { last_sync } from './iterators/last_sync'
import { first_sync } from './iterators/first_sync'
import { all_sync } from './iterators/all_sync'
import { TraverseCondition } from '../iterators/TraverseCondition'
import { prepare_index_insert } from './methods/prepare_index_insert'
import { update_index } from './methods/update_index'
import { ensure_ttl_sync } from './methods/ensure_ttl_sync'
import { remove_index } from './methods/remove_index'
import { build_index_sync } from './methods/build_index_sync'
import { ensure_indexes } from './methods/ensure_indexes'
import { get_indexed_value_sync } from './methods/get_indexed_value_sync'
import { return_list_if_valid_sync } from './methods/return_list_if_valid_sync'
import { return_one_if_valid_sync } from './methods/return_one_if_valid_sync'
import { restore_index } from './methods/restore_index'
import { deserialize_indexes } from './methods/deserialize_indexes'
import { serialize_indexes } from './methods/serialize_indexes'
import { store_index } from './methods/store_index'
import { do_rotate_log_sync } from './methods/do_rotate_log_sync'
import { StoredIList } from '../storage/StoredIList'
import { get_first_indexed_value_sync } from './methods/get_first_indexed_value_sync'
import { get_last_indexed_value_sync } from './methods/get_last_indexed_value_sync'
import Ajv, { AnySchema, ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { rebuild_indexes_sync } from './methods/rebuild_indexes_sync'
import { SyncList } from '../storage/SyncList'
import AdapterMemorySync from '../types/AdapterMemorySync'
import { IDataCollectionSync } from '../types/IDataCollectionSync'

export const ttl_key = '__ttltime'

export default class CollectionMemory<T extends Item>
  implements IDataCollectionSync<T> {
  path?: string
  cronJob?: CronJob
  onRotate: () => void
  storage: StorageAdapterSync<T>
  /** ttl for collection in ms */
  ttl: number
  /** cron tab time */
  rotate: string
  /** model name */
  model: string
  /** field that is used for identity */
  id: string
  /** is autioincrement */
  auto: boolean
  /** audit */
  audit: boolean
  /** ajv validator */
  validation: AnySchema
  validator?: ValidateFunction<T>
  /**indexes */
  indexes: { [index: string]: BPlusTree<any, any> }
  /** main storage */
  list: IListSync<T>
  /** actions in insert */
  inserts: Array<(item: T) => (index_payload: ValueType) => void>
  /** actions in update */
  updates: Array<(ov: T, nv: T, index_payload: ValueType) => void>
  /** actions in remove */
  removes: Array<(item: T) => void>
  /** actions in ensure */
  ensures: Array<() => void>
  rebuilds: Array<() => void>
  /** index definition */
  indexDefs: Dictionary<IndexDef<T>>
  /** unique generators */
  genCache: Dictionary<IdGeneratorFunction<T>>
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static create<T extends Item>(
    config?: CollectionConfigSync<T>,
  ): CollectionMemory<T> {
    const collection: CollectionMemory<T> = new CollectionMemory<T>()
    const {
      ttl,
      rotate,
      name,
      id = {
        name: 'id',
        auto: true,
        gen: 'autoIncIdGen',
      },
      auto = true,
      indexList,
      list = new SyncList<T>() as IListSync<T>,
      path,
      adapter = new AdapterMemorySync<T>(),
      validation,
      audit,
      onRotate,
    } = config ?? {}

    collection.audit = !!audit

    if (validation) {
      collection.validation = validation
      const ajv = new Ajv({ useDefaults: true })
      addFormats(ajv)
      collection.validator = ajv.compile<T>(validation)
    }
    collection.path = path ?? './data/'

    let { idGen = 'autoIncIdGen' } = config ?? {}

    if (typeof idGen == 'function') {
      idGen = idGen.toString()
    }

    if (rotate) {
      collection.onRotate = onRotate
      collection.cronJob = new CronJob(rotate, () => {
        do_rotate_log_sync(collection)
        if (typeof collection.onRotate === 'function') {
          collection.onRotate()
        }
      })
      collection.cronJob.start()
    }

    let Id: Partial<IdType<T>> = typeof id == 'string' ? { name: id } : id

    if ('string' == typeof id) {
      Id = {
        name: id,
        auto: auto != null ? auto : true,
        gen: idGen,
      }
    } else if (id instanceof Function) {
      Id = id()
    }

    if (!Id.name) {
      Id.name = 'id'
    }

    // if (Id.auto) {
    //   Id.auto = (auto == null) ? auto : true;
    // }

    if (Id.gen == null) {
      Id.gen = idGen
    }

    if (!name) {
      throw new Error('must Have Model Name as "name" prop in config')
    }

    collection.ttl = (typeof ttl == 'string' ? tp(ttl) : ttl) || false
    collection.rotate = rotate
    collection.model = name
    collection.storage = adapter.init(collection)
    collection.id = Id.name
    collection.auto = Id.auto
    collection.indexes = {}
    collection.list = list
    collection.indexDefs = {}
    collection.inserts = []
    collection.removes = []
    collection.updates = []
    collection.ensures = []
    collection.rebuilds = []

    collection.genCache = {
      autoIncIdGen: autoIncIdGen,
      autoTimestamp: autoTimestamp,
    }

    const defIndex: Array<IndexDef<T>> = [
      {
        key: collection.id,
        // type: 'number',
        auto: collection.auto,
        gen:
          typeof Id.gen == 'function'
            ? Id.gen
            : collection.genCache[Id.gen]
            ? collection.genCache[Id.gen]
            : eval(Id.gen),
        unique: true,
        sparse: false,
        required: true,
      },
    ]

    if (collection.ttl) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: collection.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    if (collection.rotate) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: collection.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    build_index_sync(
      collection,
      defIndex.concat(indexList || []).reduce((prev, curr) => {
        if (curr.key == '*') {
          prev[curr.key as string] = {
            key: '*',
            auto: false,
            unique: false,
            gen: undefined,
            sparse: false,
            required: false,
            ignoreCase: true,
          }
        } else {
          prev[curr.key as string] = {
            key: curr.key,
            auto: curr.auto || false,
            unique: curr.unique || false,
            gen:
              curr.gen ||
              (curr.auto ? collection.genCache['autoIncIdGen'] : undefined),
            sparse: curr.sparse || false,
            required: curr.required || false,
            ignoreCase: curr.ignoreCase,
            process: curr.process,
          }
        }
        return prev
      }, {} as Dictionary<IndexDef<T>>),
    )
    collection.list.init(collection)
    // придумать загрузку
    ensure_indexes(collection) ///??
    return collection
  }

  static fromList<T extends Item>(
    array: Array<T>,
    id: string,
    process?: (value) => any,
  ): CollectionMemory<T> {
    const list = CollectionMemory.create({
      name: 'default',
      indexList: [
        { key: '*' },
        { key: id, unique: true, required: true, process },
      ],
      id: { name: '$order', auto: true },
      list: new SyncList<T>(),
      adapter: new AdapterMemorySync<T>(),
    })
    array.forEach((item) => list.create(item))
    return list
  }

  reset() {
    this.list.reset()
    this.indexes = {}
    ensure_indexes(this)
  }

  load(name?: string) {
    try {
      const stored = this.storage.restore(name)
      if (stored) {
        const { indexes, list, indexDefs, id, ttl } = stored
        this.list.load(list)
        this.indexDefs = restore_index(this, indexDefs)
        this.id = id
        this.ttl = ttl

        this.inserts = []
        this.removes = []
        this.updates = []
        this.ensures = []

        this.indexes = {}
        build_index_sync(this, this.indexDefs)

        this.indexes = deserialize_indexes(indexes)
        rebuild_indexes_sync(this)
      }
    } catch (e) {
      // throw e
    }
    ensure_ttl_sync(this)
  }

  store(): {
    list: StoredIList
    indexes: { [key: string]: unknown }
    indexDefs: Dictionary<IndexStored<T>>
    id: string
    ttl: number
  } {
    return {
      list: this.list.persist(),
      indexes: serialize_indexes(this.indexes),
      indexDefs: store_index(this, this.indexDefs),
      id: this.id,
      ttl: this.ttl,
    }
  }

  persist(name?: string): void {
    this.storage.store(name)
  }

  push(item: T): T {
    // apply default once it is created
    const insert_indexed_values = prepare_index_insert(this, item)
    const id = item[this.id]
    const res = this.list.set(id, item)
    insert_indexed_values(id)
    return return_one_if_valid_sync(this, res)
  }

  create(item: T): T {
    const res = { ...item } as T

    const value = this.push(res)
    return value
  }

  save(res: T): T {
    const id = res[this.id]
    const item = this.findById(id)
    update_index(this, item, res, id)
    this.list.update(id, res)
    return return_one_if_valid_sync(this, res)
  }

  first(): T {
    return first_sync(this, () => true).next().value
  }

  last(): T {
    return last_sync(this, () => true).next().value
  }

  lowest(key: Paths<T>): T {
    return this.findFirstBy(key, this.indexes[key].min)
  }

  greatest(key: Paths<T>): T {
    return this.findLastBy(key, this.indexes[key].max)
  }

  oldest(): T {
    if (this.ttl) {
      return this.lowest(ttl_key as any)
    } else return this.first()
  }

  latest(): T {
    if (this.ttl) {
      return this.greatest(ttl_key as any)
    } else return this.last()
  }

  findById(id: ValueType): T {
    const { process } = this.indexDefs[this.id]
    if (process) {
      id = process(id)
    }
    const result = this.list.get(this.indexes[this.id].findFirst(id))
    return return_one_if_valid_sync(this, result)
  }

  findBy(key: Paths<T>, id: ValueType): Array<T> {
    if (this.indexDefs.hasOwnProperty(key)) {
      const { process } = this.indexDefs[key as string]
      if (process) {
        id = process(id)
      }

      const result = []
      if (this.indexDefs.hasOwnProperty(key)) {
        result.push(...get_indexed_value_sync(this, key, id))
      }
      return return_list_if_valid_sync(this, result)
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  findFirstBy(key: Paths<T>, id: ValueType): T {
    if (this.indexDefs.hasOwnProperty(key)) {
      const { process } = this.indexDefs[key as string]
      if (process) {
        id = process(id)
      }

      if (this.indexDefs.hasOwnProperty(key)) {
        const result = get_first_indexed_value_sync(this, key, id)
        return return_one_if_valid_sync(this, result)
      }
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  findLastBy(key: Paths<T>, id: ValueType): T {
    if (this.indexDefs.hasOwnProperty(key)) {
      const { process } = this.indexDefs[key as string]
      if (process) {
        id = process(id)
      }

      if (this.indexDefs.hasOwnProperty(key)) {
        const result = get_last_indexed_value_sync(this, key, id)
        return return_one_if_valid_sync(this, result)
      }
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  find(condition: TraverseCondition<T>): Array<T> {
    const result: Array<T> = []
    for (const item of all_sync(this, condition)) {
      result.push(item)
    }
    return return_list_if_valid_sync(this, result)
  }

  findFirst(condition: TraverseCondition<T>): T {
    const result: T = first_sync(this, condition).next().value
    return return_one_if_valid_sync(this, result)
  }

  findLast(condition: TraverseCondition<T>): T {
    const result: T = last_sync(this, condition).next().value
    return return_one_if_valid_sync(this, result)
  }

  update(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): Array<T> {
    const result: Array<T> = []
    for (const item of all_sync(this, condition)) {
      const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
      update_index(this, item, res, item[this.id])
      this.list.update(item[this.id], res)
    }
    return return_list_if_valid_sync<T>(this, result)
  }

  updateFirst(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): T {
    const item: T = first_sync(this, condition).next().value
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    update_index(this, item, res, item[this.id])
    this.list.update(item[this.id], res)

    return return_one_if_valid_sync(this, res)
  }

  updateLast(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): T {
    const item: T = last_sync(this, condition).next().value
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    update_index(this, item, res, item[this.id])
    this.list.update(item[this.id], res)

    return return_one_if_valid_sync(this, res)
  }

  updateWithId(id: ValueType, update: Partial<T>, merge: boolean = true): T {
    const item = this.findById(id)
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    update_index(this, res, update, id)
    this.list.update(id, res)
    return return_one_if_valid_sync(this, res)
  }

  removeWithId(id: ValueType): T {
    // не совсем работает удаление
    const i = this.indexes[this.id].findFirst(id)
    const cur = this.list.get(i)
    if (~i && cur) {
      remove_index(this, cur)
      const result = this.list.delete(i)
      return return_one_if_valid_sync(this, result)
    }
  }

  remove(condition: TraverseCondition<T>): Array<T> {
    const result: Array<T> = []
    for (const cur of all_sync(this, condition)) {
      remove_index(this, cur)
      const res = this.list.delete(cur[this.id])
      result.push(res)
    }
    return return_list_if_valid_sync(this, result)
  }

  removeFirst(condition: TraverseCondition<T>): T {
    const item: T = first_sync(this, condition).next().value
    remove_index(this, item)
    this.list.delete(item[this.id])
    return return_one_if_valid_sync(this, item)
  }
  removeLast(condition: TraverseCondition<T>): T {
    const item: T = last_sync(this, condition).next().value
    remove_index(this, item)
    this.list.delete(item[this.id])
    return return_one_if_valid_sync(this, item)
  }
}
