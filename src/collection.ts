// import fs from 'fs-extra';
import tp from 'timeparse'
import _ from 'lodash'
import { autoIncIdGen } from './autoIncIdGen'
import { autoTimestamp } from './autoTimestamp'
import { StorageAdapter } from './interfaces/StorageAdapter'
import { IList } from './interfaces/IList'
import { IndexDef, IndexStored, Paths } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { CollectionConfig } from './CollectionConfig'
import { CronJob } from 'cron'
import { Dictionary } from './hash'
import { BPlusTree, ValueType } from 'b-pl-tree'
import { all, first, last, TraverseCondition } from './collection/traverse'
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
import { StoredIList } from './adapters/StoredIList'
import { get_first_indexed_value } from './collection/get_first_indexed_value'
import { get_last_indexed_value } from './collection/get_last_indexed_value'

export const ttl_key = '__ttltime'

export interface IDataCollection<T extends Item> {
  reset(): Promise<void>
  load(name?: string): Promise<void>
  persist(name?: string): Promise<void>

  push(item: T): Promise<T>
  create(item: T): Promise<T>

  first(): Promise<T>
  last(): Promise<T>

  oldest(): Promise<T>
  latest(): Promise<T>

  lowest(key: Paths<T>): Promise<T>
  greatest(key: Paths<T>): Promise<T>

  find(condition: TraverseCondition<T>): Promise<Array<T>>

  findFirst(condition: TraverseCondition<T>): Promise<T>
  findLast(condition: TraverseCondition<T>): Promise<T>

  findBy(key: Paths<T>, id: ValueType): Promise<Array<T>>
  findFirstBy(key: Paths<T>, id: ValueType): Promise<T>
  findLastBy(key: Paths<T>, id: ValueType): Promise<T>

  findById(id: ValueType): Promise<T>

  update(condition: TraverseCondition<T>, update: Partial<T>): Promise<Array<T>>
  updateFirst(condition: TraverseCondition<T>, update: Partial<T>): Promise<T>
  updateLast(condition: TraverseCondition<T>, update: Partial<T>): Promise<T>

  updateWithId(id: ValueType, update: Partial<T>): Promise<T>
  removeWithId(id: ValueType): Promise<T>

  remove(condition: TraverseCondition<T>): Promise<Array<T>>
  removeFirst(condition: TraverseCondition<T>): Promise<T>
  removeLast(condition: TraverseCondition<T>): Promise<T>
}
export default class Collection<T extends Item> implements IDataCollection<T> {
  path?: string
  cronJob?: CronJob
  onRotate: () => void

  storage: StorageAdapter<T>
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
  ensures: Array<(rebuild: boolean) => Promise<void>>
  /** index definition */
  indexDefs: Dictionary<IndexDef<T>>
  /** unique generators */
  genCache: Dictionary<IdGeneratorFunction<T>>

  constructor(config?: CollectionConfig<T>) {
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
      list, // = new List<T>() as IList<T>,
      path,
      adapter, // = new AdapterFile<T>(),
      onRotate,
    } = config ?? {}
    this.path = path ?? './data/'

    let { idGen = 'autoIncIdGen' } = config ?? {}

    if (typeof idGen == 'function') {
      idGen = idGen.toString()
    }

    if (rotate) {
      this.onRotate = onRotate
      this.cronJob = new CronJob(rotate, () => {
        do_rotate_log(this)
        if (typeof this.onRotate === 'function') {
          this.onRotate()
        }
      })
      this.cronJob.start()
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

    this.ttl = (typeof ttl == 'string' ? tp(ttl) : ttl) || false
    this.rotate = rotate
    this.model = name
    this.storage = adapter.init(this)
    this.id = Id.name
    this.auto = Id.auto
    this.indexes = {}
    this.list = list.init(this)
    this.indexDefs = {}
    this.inserts = []
    this.removes = []
    this.updates = []
    this.ensures = []

    this.genCache = {
      autoIncIdGen: autoIncIdGen,
      autoTimestamp: autoTimestamp,
    }

    const defIndex: Array<IndexDef<T>> = [
      {
        key: this.id,
        // type: 'number',
        auto: this.auto,
        gen:
          typeof Id.gen == 'function'
            ? Id.gen
            : this.genCache[Id.gen]
            ? this.genCache[Id.gen]
            : eval(Id.gen),
        unique: true,
        sparse: false,
        required: true,
      },
    ]

    if (this.ttl) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: this.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    if (this.rotate) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: this.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    build_index(
      this,
      defIndex.concat(indexList || []).reduce((prev, curr) => {
        prev[curr.key as string] = {
          key: curr.key,
          auto: curr.auto || false,
          unique: curr.unique || false,
          gen:
            curr.gen || (curr.auto ? this.genCache['autoIncIdGen'] : undefined),
          sparse: curr.sparse || false,
          required: curr.required || false,
          ignoreCase: curr.ignoreCase,
          process: curr.process,
        }
        return prev
      }, {} as Dictionary<IndexDef<T>>),
    )
    // придумать загрузку
    ensure_indexes(this, false).then() ///??
  }

  async reset(): Promise<void> {
    await this.list.reset()
    this.indexes = {}
    await ensure_indexes(this, false)
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
        await ensure_indexes(this, true)
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
  ): Promise<Array<T>> {
    const result: Array<T> = []
    for await (const item of all(this, condition)) {
      const res = _.merge({}, item, update)
      update_index(this, item, res, item[this.id])
      await this.list.set(item[this.id], res)
    }
    return return_list_if_valid<T>(this, result)
  }

  async updateFirst(
    condition: TraverseCondition<T>,
    update: Partial<T>,
  ): Promise<T> {
    const item: T = await (await first(this, condition).next()).value
    const res = _.merge({}, item, update)
    update_index(this, item, res, item[this.id])
    await this.list.set(item[this.id], res)

    return return_one_if_valid(this, res)
  }

  async updateLast(
    condition: TraverseCondition<T>,
    update: Partial<T>,
  ): Promise<T> {
    const item: T = await (await last(this, condition).next()).value
    const res = _.merge({}, item, update)
    update_index(this, item, res, item[this.id])
    await this.list.set(item[this.id], res)

    return return_one_if_valid(this, res)
  }

  async updateWithId(id: ValueType, update: Partial<T>): Promise<T> {
    const item = await this.findById(id)
    const res = _.merge({}, item, update)
    update_index(this, res, update, id)
    this.list.set(id, res)
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
