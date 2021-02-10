// import fs from 'fs-extra';
import tp from 'timeparse'
import _, { unset } from 'lodash'
import { autoIncIdGen } from './autoIncIdGen'
import { autoTimestamp } from './autoTimestamp'
import { StorageAdapter } from './StorageAdapter'
import { List } from './List'
import { IndexDef, Paths } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { CollectionConfig } from './CollectionConfig'
import AdapterFile from './adapter-fs'
import { CronJob } from 'cron'
import { Dictionary } from './hash'
import { BPlusTree, query } from 'b-pl-tree'
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
  indexes: { [index: string]: BPlusTree<number, number> }
  /** main storage */
  list: List<T>
  /** actions in insert */
  inserts: Array<(item: T) => (i: number) => void>
  /** actions in update */
  updates: Array<(ov: T, nv: T, i: any) => void>
  /** actions in remove */
  removes: Array<(item: T, i: any) => void>
  /** actions in ensure */
  ensures: Array<() => void>
  /** index definition */
  indexDefs: Dictionary<IndexDef<T>>
  /** unique generators */
  genCache: Dictionary<IdGeneratorFunction<T>>

  clone(withData?: boolean) {
    let collection = new Collection<T>({
      name: this.model,
      adapter: this.storage.clone(),
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
    if (withData) {
      this.list.toArray().forEach((i) => collection.push(i))
    }
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
      adapter = new AdapterFile<T>(path),
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

    this.storage = adapter.init(this)
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
    this.id = Id.name
    this.auto = Id.auto
    this.indexes = {}
    this.list = new List()
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
    this.list.length = 0
    this.indexes = {}
    ensure_indexes(this)
  }

  async load(name?: string): Promise<void> {
    try {
      const stored = await this.storage.restore(name)
      if (stored) {
        let { indexes, list, indexDefs, id, ttl } = stored
        this.list.load(list)
        this.indexDefs = restore_index(indexDefs)
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
    ensure_ttl(this)
  }

  store() {
    return {
      list: this.list.persist(),
      indexes: serialize_indexes(this.indexes),
      indexDefs: store_index(this.indexDefs),
      id: this.id,
      ttl: this.ttl,
    }
  }

  async persist(name?: string): Promise<void> {
    await this.storage.store(name)
  }

  push(item) {
    let insert = prepare_index_insert(this, item)
    this.list.push(item)
    insert(this.list.counter - 1)
  }

  create(item: T): T {
    let res = { ...item } as T
    this.push(res)
    return res
  }

  findById(id): T {
    let { process } = this.indexDefs[this.id]
    if (process) {
      id = process(id)
    }
    const result = this.list.get(this.indexes[this.id][id] as number | string)
    return return_one_if_valid(this, result)
  }

  findBy(key: Paths<T>, id): Array<T> {
    let { process } = this.indexDefs[key as string]
    if (process) {
      id = process(id)
    }

    let result = []
    if (this.indexDefs.hasOwnProperty(key)) {
      result.push(...get_indexed_value(this, key, id))
    }
    return return_list_if_valid(this, result)
  }

  query(filter) {}

  find(condition): Array<T> {
    const result = []
    traverse(this, condition, (i, cur) => {
      result.push(cur)
      return true
    })
    return return_list_if_valid(this, result)
  }

  findOne(condition): T {
    let result
    traverse(this, condition, (i, cur) => {
      result = cur
    })
    return return_one_if_valid(this, result)
  }

  update(condition, update: Partial<T>) {
    traverse(this, condition, (i, cur) => {
      update_index(this, cur, update, i)
      for (let u in update) {
        cur[u] = update[u]
      }
      return true
    })
  }

  updateOne(condition, update: Partial<T>) {
    traverse(this, condition, (i, cur) => {
      update_index(this, cur, update, i)
      for (let u in update) {
        cur[u] = update[u]
      }
    })
  }

  updateWithId(id, update: Partial<T>) {
    let result = this.findById(id)
    update_index(this, result, update, id)
    _.assign(result, update)
  }

  removeWithId(id) {
    let i = this.indexes[this.id][id] as number | string
    let cur = this.list.get(i)
    if (~i && cur) {
      remove_index(this, cur, i)
      this.list.remove(i)
    }
  }

  remove(condition) {
    traverse(this, condition, (i, cur) => {
      remove_index(this, cur, i)
      this.list.remove(i)
      return true
    })
  }

  removeOne(condition) {
    traverse(this, condition, (i, cur) => {
      remove_index(this, cur, i)
      this.list.remove(i)
    })
  }
}
