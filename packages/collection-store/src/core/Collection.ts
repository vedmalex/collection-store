// import fs from 'fs-extra';
import { EventEmitter } from 'events'
import tp from '../utils/timeparse'
import * as _ from 'lodash-es'
import { autoIncIdGen } from '../utils/autoIncIdGen'
import { autoTimestamp } from '../utils/autoTimestamp'
import { IStorageAdapter } from '../types/IStorageAdapter'
import { IList } from '../types/IList'
import { IndexDef, SerializedIndexDef } from '../types/IndexDef'
import { IndexStored } from '../types/IndexStored'
import { Paths } from '../types/Paths'
import { Item, ItemSchema } from '../types/Item'
import { IdGeneratorFunction } from '../types/IdGeneratorFunction'
import { IdType } from '../types/IdType'
import {
  ICollectionConfig,
  ISerializedCollectionConfig,
} from '../types/ICollectionConfig'
import { CronJob } from 'cron'
import { Dictionary } from '../types/Dictionary'
import { BPlusTree, ValueType } from 'b-pl-tree'
import { last } from '../iterators/last'
import { first } from '../iterators/first'
import { all } from '../iterators/all'
import { TraverseCondition } from '../types/TraverseCondition'
import { prepare_index_insert } from '../collection/prepare_index_insert'
import { update_index } from '../collection/update_index'
import { ensure_ttl } from '../collection/ensure_ttl'
import { remove_index } from '../collection/remove_index'
import { build_indexes } from '../collection/build_indexes'
import { ensure_indexes } from '../collection/ensure_indexes'
import { get_indexed_value } from '../collection/get_indexed_value'
import { return_list_if_valid } from '../collection/return_list_if_valid'
import { return_one_if_valid } from '../collection/return_one_if_valid'
import { restore_index } from '../collection/restore_index'
import { deserialize_indexes } from '../collection/deserialize_indexes'
import { serialize_indexes } from '../collection/serialize_indexes'
import { store_index } from '../collection/store_index'
import { do_rotate_log } from '../collection/do_rotate_log'
import { StoredIList } from '../types/StoredIList'
import { get_first_indexed_value } from '../collection/get_first_indexed_value'
import { get_last_indexed_value } from '../collection/get_last_indexed_value'
import { rebuild_indexes } from '../collection/rebuild_indexes'
import { List } from '../storage/List'
import AdapterMemory from '../storage/adapters/AdapterMemory'
import { IDataCollection } from '../types/IDataCollection'
import { ProcessInsert } from '../utils/ProcessInsert'
import { ProcessUpdates } from '../utils/ProcessUpdates'
import { ProcessRemoves } from '../utils/ProcessRemoves'
import { ProcessEnsure } from '../utils/ProcessEnsure'
import { ProcessRebuild } from '../utils/ProcessRebuild'
import { create_index } from '../collection/create_index'
import { ZodError, ZodSchema, ZodType } from 'zod'
import { serialize_collection_config } from '../collection/serialize_collection_config'
import { CompositeKeyUtils } from '../utils/CompositeKeyUtils'
import { ITransactionalStorageAdapter } from '../types/ITransactionalStorageAdapter'

export const ttl_key = '__ttltime'

export default class Collection<T extends Item> implements IDataCollection<T> {
  get config(): ISerializedCollectionConfig {
    return serialize_collection_config(this)
  }

  /** unique generators */
  static genCache: Dictionary<IdGeneratorFunction<any>> = {
    autoIncIdGen: autoIncIdGen as IdGeneratorFunction<any>,
    autoTimestamp: autoTimestamp as IdGeneratorFunction<any>,
  }

  root!: string
  cronJob?: CronJob
  async createIndex(name: string, config: IndexDef<T>): Promise<void> {
    create_index(this, name, config)
    await ensure_indexes(this)
    //ensure
    //rebuild
  }

  listIndexes(name: string) {
    if (!name) {
      return Object.keys(this.indexes).map((name) => ({
        name,
        key: { name: this.indexes[name] },
      }))
    } else {
      if (this.indexes[name]) {
        return [{ name, keys: { name: this.indexes[name] } }]
      } else {
        return [] as any
      }
    }
  }

  dropIndex(name: string) {
    delete this.indexes[name]
  }

  storage!: IStorageAdapter<T>
  /** ttl for collection in ms */
  ttl?: number
  /** cron tab time */
  rotate?: string
  /** model name */
  name!: string
  /** field that is used for identity */
  id!: string
  /** is autioincrement */
  auto?: boolean
  /** audit */
  audit!: boolean
  /** zod validator */
  validation: ZodType<T> = ItemSchema as ZodSchema<T>
  validator(item: T):
    | { success: true; data: T }
    | {
      success: false
      errors: ZodError<T>
    } {
    if (this.validation) {
      return this.validation.safeParse(item) as any
    } else {
      return { success: true, data: item as T }
    }
  }
  /**indexes */
  indexes!: { [index: string]: BPlusTree<any, any> }
  /** main storage */
  list!: IList<T>
  /** actions in insert */
  inserts!: Array<ProcessInsert<T>>
  /** actions in update */
  updates!: Array<ProcessUpdates<T>>
  /** actions in remove */
  removes!: Array<ProcessRemoves<T>>
  /** actions in ensure */
  ensures!: Array<ProcessEnsure>
  rebuilds!: Array<ProcessRebuild>
  /** index definition */
  indexDefs!: Dictionary<IndexDef<T>>

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

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
      validation,
      audit,
      root,
      dbName,
    } = config ?? {}

    // Determine adapter based on dbName (MikroORM convention)
    let adapter = config?.adapter
    if (!adapter) {
      if (dbName === ':memory:') {
        adapter = new AdapterMemory<T>()
      } else {
        adapter = new AdapterMemory<T>() // Default to memory for backward compatibility
      }
    }

    collection.audit = !!audit
    if (validation) {
      collection.validation = validation
    }
    collection.root = root ?? './data/'

    let { idGen = 'autoIncIdGen' } = config ?? {}

    if (typeof idGen == 'function') {
      idGen = idGen.toString()
    }

    if (rotate) {
      collection.cronJob = new CronJob(rotate, () => {
        do_rotate_log(collection)
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
    }

    if (!Id.name) {
      Id.name = 'id'
    }

    if (Id.gen == null) {
      Id.gen = idGen
    }

    if (!name) {
      throw new Error('must Have Model Name as "name" prop in config')
    }

    collection.ttl = (typeof ttl == 'string' ? tp(ttl) : ttl) || undefined

    collection.rotate = rotate
    collection.name = name
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

    const defIndex: Array<IndexDef<T>> = [
      {
        key: collection.id,
        // type: 'number',
        auto: collection.auto,
        gen:
          typeof Id.gen == 'function'
            ? Id.gen
            : Id.gen && Collection.genCache[Id.gen]
              ? Collection.genCache[Id.gen]
              : Id.gen ? eval(Id.gen) : undefined,
        unique: true,
        sparse: false,
        required: true,
      },
    ]

    if (collection.ttl) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: Collection.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    if (collection.rotate) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: Collection.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    build_indexes(
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
          // Use unified approach for index processing
          try {
            const normalizedFields = CompositeKeyUtils.normalizeIndexFields(curr)
            const isCompositeIndex = normalizedFields.length > 1
            const indexKey = CompositeKeyUtils.generateIndexName(normalizedFields)

                        // Determine separator for composite indexes
            let separator: string | undefined
            if (isCompositeIndex) {
              separator = curr.separator || CompositeKeyUtils.DEFAULT_SEPARATOR
            }

            prev[indexKey] = {
              key: isCompositeIndex ? undefined : normalizedFields[0].key,
              keys: isCompositeIndex ? normalizedFields : undefined,
              order: !isCompositeIndex ? normalizedFields[0].order : undefined,
              separator: separator,
              auto: curr.auto || false,
              unique: curr.unique || false,
              gen:
                curr.gen ||
                (curr.auto ? Collection.genCache['autoIncIdGen'] : undefined),
              sparse: curr.sparse || false,
              required: curr.required || false,
              ignoreCase: curr.ignoreCase,
              process: curr.process,
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            throw new Error(`Invalid index definition: ${errorMessage}`)
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

  static async fromList<T extends Item>(
    array: Array<T>,
    id: string,
    root: string,
  ) {
    const list = Collection.create({
      root,
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
        build_indexes(this, this.indexDefs)

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
    ttl?: number
    rotate?: number
  } {
    return {
      list: this.list.persist(),
      indexes: serialize_indexes(this.indexes),
      indexDefs: store_index(this, this.indexDefs),
      id: this.id,
      ttl: this.ttl,
      rotate: this.rotate ? parseInt(this.rotate) : undefined,
    }
  }

  async persist(name?: string): Promise<void> {
    await this.storage.store(name)
  }

  //
  async push(item: T): Promise<T | undefined> {
    // apply default once it is created
    const insert_indexed_values = prepare_index_insert(this, item)
    const id = item[this.id]
    const res = await this.list.set(id, item)
    insert_indexed_values(id)
    return return_one_if_valid(this, res)
  }

  async create(item: T): Promise<T | undefined> {
    const res = { ...item } as T
    const value = await this.push(res)
    return value
  }

  async save(res: T): Promise<T | undefined> {
    const id = res[this.id]
    const item = await this.findById(id)
    await update_index(this, item as T, res as T, id)
    await this.list.update(id, res)
    return return_one_if_valid(this, res)
  }

  async first(): Promise<T> {
    return (await first(this, () => true).next()).value
  }

  async last(): Promise<T> {
    return (await last(this, () => true).next()).value
  }

  lowest(key: Paths<T>): Promise<T | undefined> {
    if (!this.indexes[key]) {
      throw new Error(`Index for ${key} not found`)
    }

    // Get the minimum key from the B+ tree
    const minKey = this.indexes[key].min

    if (minKey === undefined || minKey === null) {
      return Promise.resolve(undefined)
    }

    return this.findFirstBy(key, minKey)
  }

  greatest(key: Paths<T>): Promise<T | undefined> {
    if (!this.indexes[key]) {
      throw new Error(`Index for ${key} not found`)
    }

    // Get the maximum key from the B+ tree
    const maxKey = this.indexes[key].max

    if (maxKey === undefined || maxKey === null) {
      return Promise.resolve(undefined)
    }

    return this.findFirstBy(key, maxKey)
  }

  oldest(): Promise<T | undefined> {
    if (this.ttl) {
      return this.lowest(ttl_key as any)
    } else return this.first()
  }

  latest(): Promise<T | undefined> {
    if (this.ttl) {
      return this.greatest(ttl_key as any)
    } else return this.last()
  }

  async findById(id: ValueType): Promise<T | undefined> {
    // Don't apply process function when searching by ID - it's only used for creating index values from items
    const index = this.indexes[this.id]
    if (!index) {
      throw new Error(`Index for ${this.id} not found`)
    }
    const result = await this.list.get(index.findFirst(id))
    return return_one_if_valid(this, result)
  }

  async findBy(key: Paths<T>, id: ValueType): Promise<Array<T>> {
    if (this.indexDefs.hasOwnProperty(key)) {
      // Don't apply process function when searching - it's only used for creating index values from items
      // The search value should be used as-is

      const result: Array<T> = []
      if (this.indexDefs.hasOwnProperty(key)) {
        const indexedValues = await get_indexed_value(this, key, id)
        result.push(...indexedValues)
      }
      return return_list_if_valid(this, result)
    } else {
      throw new Error(`Index for ${key} not found`)
    }
  }

  async findFirstBy(key: Paths<T>, id: ValueType): Promise<T | undefined> {
    if (this.indexDefs.hasOwnProperty(key)) {
      // Don't apply process function when searching - it's only used for creating index values from items

      if (this.indexDefs.hasOwnProperty(key)) {
        const result = await get_first_indexed_value(this, key, id)
        return return_one_if_valid(this, result)
      }
    }
    throw new Error(`Index for ${key} not found`)
  }

  async findLastBy(key: Paths<T>, id: ValueType): Promise<T | undefined> {
    if (this.indexDefs.hasOwnProperty(key)) {
      // Don't apply process function when searching - it's only used for creating index values from items

      if (this.indexDefs.hasOwnProperty(key)) {
        const result = await get_last_indexed_value(this, key, id)
        return return_one_if_valid(this, result)
      }
    }
    throw new Error(`Index for ${key} not found`)
  }

  async find(condition: TraverseCondition<T>): Promise<Array<T>> {
    const result: Array<T> = []
    for await (const item of all(this, condition)) {
      result.push(item)
    }
    return return_list_if_valid(this, result)
  }

  async findFirst(condition: TraverseCondition<T>): Promise<T | undefined> {
    const result: T = await (await first(this, condition).next()).value
    return return_one_if_valid(this, result)
  }

  async findLast(condition: TraverseCondition<T>): Promise<T | undefined> {
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
      await update_index(this, item, res as T, item[this.id])
      await this.list.update(item[this.id], res)
      result.push(res)
    }
    return return_list_if_valid<T>(this, result)
  }

  async updateFirst(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<T | undefined> {
    const item: T = await (await first(this, condition).next()).value
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    await update_index(this, item, res as T, item[this.id])
    await this.list.update(item[this.id], res)
    return return_one_if_valid(this, res as T)
  }

  async updateLast(
    condition: TraverseCondition<T>,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<T | undefined> {
    const item: T = await (await last(this, condition).next()).value
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    await update_index(this, item, res as T, item[this.id])
    await this.list.update(item[this.id], res)

    return return_one_if_valid(this, res as T)
  }

  async updateWithId(
    id: ValueType,
    update: Partial<T>,
    merge: boolean = true,
  ): Promise<T | undefined> {
    const item = await this.findById(id)
    const res = merge ? _.merge({}, item, update) : _.assign({}, item, update)
    await update_index(this, item as T, res as T, id)
    await this.list.update(id, res)
    return return_one_if_valid(this, res as T)
  }

  async removeWithId(id: ValueType): Promise<T | undefined> {
    // Don't apply process function when searching by ID - it's only used for creating index values from items
    const index = this.indexes[this.id]
    if (!index) {
      throw new Error(`Index for ${this.id} not found`)
    }
    const i = index.findFirst(id)
    const cur = await this.list.get(i)
    if (i !== undefined && cur) {
      remove_index(this, cur)
      const result = await this.list.delete(id) // Use the actual ID, not the index position
      return return_one_if_valid(this, result)
    }
  }

  async remove(condition: TraverseCondition<T>): Promise<Array<T | undefined>> {
    const result: Array<T> = []
    for await (const cur of all(this, condition)) {
      remove_index(this, cur)
      const res = await this.list.delete(cur[this.id])
      result.push(res)
    }
    return return_list_if_valid<T>(this, result)
  }

  async removeFirst(condition: TraverseCondition<T>): Promise<T | undefined> {
    const item: T = await (await first(this, condition).next()).value
    remove_index(this, item)
    await this.list.delete(item[this.id])
    return return_one_if_valid(this, item)
  }
  async removeLast(condition: TraverseCondition<T>): Promise<T | undefined> {
    const item: T = await (await last(this, condition).next()).value
    remove_index(this, item)
    await this.list.delete(item[this.id])
    return return_one_if_valid(this, item)
  }
}

export function serializeIndex<T extends Item>(
  res: IndexDef<T>,
): SerializedIndexDef {
  return {
    key: res.key as string,
    keys: res.keys as any,
    order: res.order,
    separator: res.separator,
    auto: res.auto ? true : undefined,
    unique: res.unique ? true : undefined,
    sparse: res.sparse ? true : undefined,
    ignoreCase: res.ignoreCase ? true : undefined,
    required: res.required ? true : undefined,
    gen: res.gen?.name ?? undefined,
    process: res.process?.toString() ?? undefined,
  }
}

export function deserializeIndex<T extends Item>(
  res: SerializedIndexDef,
): IndexDef<T> {
  return {
    key: res.key,
    keys: res.keys as any,
    order: res.order,
    separator: res.separator,
    auto: res.auto ? true : undefined,
    unique: res.unique ? true : undefined,
    sparse: res.sparse ? true : undefined,
    ignoreCase: res.ignoreCase ? true : undefined,
    required: res.required ? true : undefined,
    gen: res.gen ? Collection.genCache[res.gen] : undefined,
    process: res.process ? eval(res.process) : undefined,
  }
}
