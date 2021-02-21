// import fs from 'fs-extra';
import tp from 'timeparse'
import _ from 'lodash'
import { autoIncIdGen } from './autoIncIdGen'
import { autoTimestamp } from './autoTimestamp'
import { StorageAdapter } from './interfaces/StorageAdapter'
import { List } from './adapters/List'
import { IList } from './interfaces/IList'
import { IndexDef, Paths, keyType } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { CollectionConfig } from './CollectionConfig'
import AdapterFS from './adapter-fs'
import { CronJob } from 'cron'
import { Dictionary } from './hash'
import { BPlusTree, query, ValueType } from 'b-pl-tree'
import { traverse } from './collection/traverse'
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

export const ttl_key = '__ttltime'
export default class Collection<T extends Item> {
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
  inserts: Array<(item: T) => (index_payload: any) => void>
  /** actions in update */
  updates: Array<(ov: T, nv: T, index_payload: any) => void>
  /** actions in remove */
  removes: Array<(item: T) => void>
  /** actions in ensure */
  ensures: Array<() => void>
  /** index definition */
  indexDefs: Dictionary<IndexDef<T>>
  /** unique generators */
  genCache: Dictionary<IdGeneratorFunction<T>>

  async clone() {
    let collection = new Collection<T>({
      name: this.model,
      adapter: this.storage.clone(),
      list: await this.list.clone(),
    })

    collection.indexDefs = this.indexDefs
    collection.id = this.id
    collection.ttl = this.ttl

    collection.inserts = []
    collection.removes = []
    collection.updates = []
    collection.ensures = []

    collection.indexes = {}
    build_index(collection, collection.indexDefs)
    ensure_indexes(collection)
    return collection
  }

  constructor(config?: CollectionConfig<T>) {
    let {
      ttl,
      rotate,
      name,
      id = {
        name: 'id',
        auto: true,
        gen: 'autoIncIdGen',
      },
      idGen = 'autoIncIdGen',
      auto = true,
      indexList,
      path,
      list = new List<T>() as IList<T>,
      adapter = new AdapterFS<T>(path),
      onRotate,
    } = config ?? {}

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

    let defIndex: Array<IndexDef<T>> = [
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
    ensure_indexes(this)
  }

  reset() {
    this.list.reset()
    this.indexes = {}
    ensure_indexes(this)
  }

  async load(name?: string): Promise<void> {
    try {
      const stored = await this.storage.restore(name)
      if (stored) {
        let { indexes, list, indexDefs, id, ttl } = stored
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
        ensure_indexes(this)
      }
    } catch (e) {
      // throw e
    }
    await ensure_ttl(this)
  }

  store() {
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

  async push(item: T) {
    let insert_indexed_values = prepare_index_insert(this, item)
    const id = item[this.id]
    const res = await this.list.set(id, item)
    insert_indexed_values(id)
    return res
  }

  async create(item: T): Promise<T> {
    let res = { ...item } as T
    return await this.push(res)
  }

  async findById(id): Promise<T> {
    let { process } = this.indexDefs[this.id]
    if (process) {
      id = process(id)
    }
    const result = await this.list.get(
      this.indexes[this.id][id] as number | string,
    )
    return return_one_if_valid(this, result)
  }

  async findBy(key: Paths<T>, id): Promise<Array<T>> {
    let { process } = this.indexDefs[key as string]
    if (process) {
      id = process(id)
    }

    let result = []
    if (this.indexDefs.hasOwnProperty(key)) {
      result.push(...(await get_indexed_value(this, key, id)))
    }
    return return_list_if_valid(this, result)
  }

  where(field: Paths<T>, op: '') {}

  async find(condition): Promise<Array<T>> {
    const result = []
    await traverse(this, condition, async (cur) => {
      result.push(cur)
      return true
    })
    return return_list_if_valid(this, result)
  }

  async findOne(condition): Promise<T> {
    let result
    await traverse(this, condition, async (cur) => {
      result = cur
    })
    return return_one_if_valid(this, result)
  }

  async update(condition, update: Partial<T>) {
    await traverse(this, condition, async (cur) => {
      update_index(this, cur, update, cur[this.id])
      for (let u in update) {
        cur[u] = update[u]
      }
      return true
    })
  }

  async updateOne(condition, update: Partial<T>) {
    await traverse(this, condition, async (cur) => {
      update_index(this, cur, update, cur[this.id])
      for (let u in update) {
        cur[u] = update[u]
      }
    })
  }

  async updateWithId(id, update: Partial<T>) {
    let result = await this.findById(id)
    update_index(this, result, update, id)
    _.assign(result, update)
  }

  async removeWithId(id) {
    // не совсем работает удаление
    let i = this.indexes[this.id].findFirst(id)
    let cur = await this.list.get(i)
    if (~i && cur) {
      remove_index(this, cur)
      await this.list.delete(i)
    }
  }

  async remove(condition) {
    await traverse(this, condition, async (cur) => {
      remove_index(this, cur)
      await this.list.delete(cur[this.id])
      return true
    })
  }

  async removeOne(condition) {
    await traverse(this, condition, async (cur) => {
      remove_index(this, cur)
      await this.list.delete(cur[this.id])
    })
  }
}
