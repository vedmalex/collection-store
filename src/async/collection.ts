// import fs from 'fs-extra';
import tp from 'timeparse'
import _ from 'lodash'
import { autoIncIdGen } from '../utils/autoIncIdGen'
import { autoTimestamp } from '../utils/autoTimestamp'
import { IStorageAdapter } from './IStorageAdapter'
import { IList } from './IList'
import { IndexDef } from '../types/IndexDef'
import { IndexStored } from '../types/IndexStored'
import { Paths } from '../types/Paths'
import { Item } from '../types/Item'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import { IdType } from '../types/IdType'
import { ICollectionConfig } from './ICollectionConfig'
import { CronJob } from 'cron'
import { Dictionary } from '../types/Dictionary'
import { BPlusTree, ValueType } from 'b-pl-tree'
import { last } from './iterators/last'
import { first } from './iterators/first'
import { all } from './iterators/all'
import { TraverseCondition } from '../types/TraverseCondition'
import { prepare_index_insert } from './collection/prepare_index_insert'
import { update_index } from './collection/update_index'
import { ensure_ttl } from './collection/ensure_ttl'
import { remove_index } from './collection/remove_index'
import { build_index } from './collection/build_index'
import { ensure_indexes } from './collection/ensure_indexes'
import { get_indexed_value } from './collection/get_indexed_value'
import { return_list_if_valid } from './collection/return_list_if_valid'
import { return_one_if_valid } from './collection/return_one_if_valid'
import { restore_index } from './collection/restore_index'
import { deserialize_indexes } from './collection/deserialize_indexes'
import { serialize_indexes } from './collection/serialize_indexes'
import { store_index } from './collection/store_index'
import { do_rotate_log } from './collection/do_rotate_log'
import { StoredIList } from '../types/StoredIList'
import { get_first_indexed_value } from './collection/get_first_indexed_value'
import { get_last_indexed_value } from './collection/get_last_indexed_value'
import Ajv, { AnySchema, ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { rebuild_indexes } from './collection/rebuild_indexes'
import { List } from './storage/List'
import AdapterMemory from './AdapterMemory'
import { IDataCollection } from './IDataCollection'

export const ttl_key = '__ttltime'

export default class Collection<T extends Item> implements IDataCollection<T> {
  path?: string
  cronJob?: CronJob
  onRotate: () => void

  storage: IStorageAdapter<T>
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
  list: IList<T>
  /** actions in insert */
  inserts: Array<(item: T) => (index_payload: ValueType) => void>
  /** actions in update */
  updates: Array<(ov: T, nv: T, index_payload: ValueType) => void>
  /** actions in remove */
  removes: Array<(item: T) => void>
  /** actions in ensure */
  ensures: Array<() => void>
  rebuilds: Array<() => Promise<void>>
  /** index definition */
  indexDefs: Dictionary<IndexDef<T>>
  /** unique generators */
  genCache: Dictionary<IdGeneratorFunction<T>>
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static create<T extends Item>(config?: ICollectionConfig<T>) {
    const collection: Collection<T> = new Collection<T>()
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
      list = new List<T>() as IList<T>,
      path,
      adapter = new AdapterMemory<T>(),
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
        do_rotate_log(collection)
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

    build_index(
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

  static async fromList<T extends Item>(array: Array<T>, id: string) {
    const list = Collection.create({
      name: 'default',
      indexList: [{ key: '*' }, { key: id, unique: true, required: true }],
      id: { name: '$order', auto: true },
      list: new List<T>(),
      adapter: new AdapterMemory<T>(),
    })
    await Promise.all(array.map((item) => list.create(item)))
    return list
  }

  async reset(): Promise<void> {
    await this.list.reset()
    this.indexes = {}
    ensure_indexes(this)
  }

  async load(name?: string): Promise<void> {
    try {
      const stored = await this.storage.restore(name)
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
        build_index(this, this.indexDefs)

        this.indexes = deserialize_indexes(indexes)
        await rebuild_indexes(this)
      }
    } catch (e) {
      // throw e
    }
    await ensure_ttl(this)
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

  async persist(name?: string): Promise<void> {
    await this.storage.store(name)
  }

  async push(item: T): Promise<T> {
    // apply default once it is created
    const insert_indexed_values = prepare_index_insert(this, item)
    const id = item[this.id]
    const res = await this.list.set(id, item)
    insert_indexed_values(id)
    return return_one_if_valid(this, res)
  }

  async create(item: T): Promise<T> {
    const res = { ...item } as T

    const value = await this.push(res)
    return value
  }

  async save(res: T): Promise<T> {
    const id = res[this.id]
    const item = await this.findById(id)
    update_index(this, item, res, id)
    await this.list.update(id, res)
    return return_one_if_valid(this, res)
  }

  async first(): Promise<T> {
    return (await first(this, () => true).next()).value
  }

  async last(): Promise<T> {
    return (await last(this, () => true).next()).value
  }

  lowest(key: Paths<T>): Promise<T> {
    return this.findFirstBy(key, this.indexes[key].min)
  }

  greatest(key: Paths<T>): Promise<T> {
    return this.findLastBy(key, this.indexes[key].max)
  }

  oldest(): Promise<T> {
    if (this.ttl) {
      return this.lowest(ttl_key as any)
    } else return this.first()
  }

  latest(): Promise<T> {
    if (this.ttl) {
      return this.greatest(ttl_key as any)
    } else return this.last()
  }

  async findById(id: ValueType): Promise<T> {
    const { process } = this.indexDefs[this.id]
    if (process) {
      id = process(id)
    }
    const result = await this.list.get(this.indexes[this.id].findFirst(id))
    return return_one_if_valid(this, result)
  }

  async findBy(key: Paths<T>, id: ValueType): Promise<Array<T>> {
    if (this.indexDefs.hasOwnProperty(key)) {
      const { process } = this.indexDefs[key as string]
      if (process) {
        id = process(id)
      }

      const result = []
      if (this.indexDefs.hasOwnProperty(key)) {
        result.push(...(await get_indexed_value(this, key, id)))
      }
      return return_list_if_valid(this, result)
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  async findFirstBy(key: Paths<T>, id: ValueType): Promise<T> {
    if (this.indexDefs.hasOwnProperty(key)) {
      const { process } = this.indexDefs[key as string]
      if (process) {
        id = process(id)
      }

      if (this.indexDefs.hasOwnProperty(key)) {
        const result = await get_first_indexed_value(this, key, id)
        return return_one_if_valid(this, result)
      }
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  async findLastBy(key: Paths<T>, id: ValueType): Promise<T> {
    if (this.indexDefs.hasOwnProperty(key)) {
      const { process } = this.indexDefs[key as string]
      if (process) {
        id = process(id)
      }

      if (this.indexDefs.hasOwnProperty(key)) {
        const result = await get_last_indexed_value(this, key, id)
        return return_one_if_valid(this, result)
      }
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  async find(condition: TraverseCondition<T>): Promise<Array<T>> {
    const result: Array<T> = []
    for await (const item of all(this, condition)) {
      result.push(item)
    }
    return return_list_if_valid(this, result)
  }

  async findFirst(condition: TraverseCondition<T>): Promise<T> {
    const result: T = await (await first(this, condition).next()).value
    return return_one_if_valid(this, result)
  }

  async findLast(condition: TraverseCondition<T>): Promise<T> {
    const result: T = await (await last(this, condition).next()).value
    return return_one_if_valid(this, result)
  }

  async update(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<Array<T>> {
    const result: Array<T> = []
    for await (const item of all(this, condition)) {
      const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
      update_index(this, item, res, item[this.id])
      await this.list.update(item[this.id], res)
    }
    return return_list_if_valid<T>(this, result)
  }

  async updateFirst(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<T> {
    const item: T = await (await first(this, condition).next()).value
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    update_index(this, item, res, item[this.id])
    await this.list.update(item[this.id], res)

    return return_one_if_valid(this, res)
  }

  async updateLast(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<T> {
    const item: T = await (await last(this, condition).next()).value
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    update_index(this, item, res, item[this.id])
    await this.list.update(item[this.id], res)

    return return_one_if_valid(this, res)
  }

  async updateWithId(
    id: ValueType,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<T> {
    const item = await this.findById(id)
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    update_index(this, res, update, id)
    this.list.update(id, res)
    return return_one_if_valid(this, res)
  }

  async removeWithId(id: ValueType): Promise<T> {
    // не совсем работает удаление
    const i = this.indexes[this.id].findFirst(id)
    const cur = await this.list.get(i)
    if (~i && cur) {
      remove_index(this, cur)
      const result = await this.list.delete(i)
      return return_one_if_valid(this, result)
    }
  }

  async remove(condition: TraverseCondition<T>): Promise<Array<T>> {
    const result: Array<T> = []
    for await (const cur of all(this, condition)) {
      remove_index(this, cur)
      const res = await this.list.delete(cur[this.id])
      result.push(res)
    }
    return return_list_if_valid(this, result)
  }

  async removeFirst(condition: TraverseCondition<T>): Promise<T> {
    const item: T = await (await first(this, condition).next()).value
    remove_index(this, item)
    await this.list.delete(item[this.id])
    return return_one_if_valid(this, item)
  }
  async removeLast(condition: TraverseCondition<T>): Promise<T> {
    const item: T = await (await last(this, condition).next()).value
    remove_index(this, item)
    await this.list.delete(item[this.id])
    return return_one_if_valid(this, item)
  }
}
