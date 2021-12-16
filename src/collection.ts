// import fs from 'fs-extra';
import tp from 'timeparse'
import _, { get, set, unset } from 'lodash'
import { autoIncIdGen } from './autoIncIdGen'
import { autoTimestamp } from './autoTimestamp'
import { StorageAdapter } from './StorageAdapter'
import { List } from './List'
import { IndexDef, IndexStored, Paths } from './IndexDef'
import { Item } from './Item'
import { IdGeneratorFunction } from './IdGeneratorFunction'
import { IdType } from './IdType'
import { CollectionConfig } from './CollectionConfig'
import AdapterFile from './adapter-fs'
import { CronJob } from 'cron'
import { Dictionary } from './hash'
export default class Collection<T extends Item> {
  cronJob?: CronJob
  onRotate: () => void
  storage: StorageAdapter<T>
  ttl: number
  /** cron tab time */
  rotate: string
  model: string
  id: string
  auto: boolean
  indexes: { [index: string]: { [key: string]: number | Array<number> } }
  list: List<T>

  inserts: Array<(item: T) => (i: number) => void>
  updates: Array<(ov: T, nv: T, i: any) => void>
  removes: Array<(item: T, i: any) => void>
  ensures: Array<() => void>
  indexDefs: Dictionary<IndexDef<T>>
  genCache: Dictionary<IdGeneratorFunction<T>>

  clone(withData?: boolean) {
    const collection = new Collection<T>({
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
    collection._buildIndex(collection.indexDefs)
    collection.ensureIndexes()
    if (withData) {
      this.list.toArray().forEach((i) => collection.push(i))
    }
    return collection
  }
  constructor(config?: Partial<CollectionConfig<T>>) {
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
        this.doRotate()
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
      throw new Error('must Have Model Name as "model" prop in config')
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

    const defIndex: Array<IndexDef<T>> = [
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
        key: '__ttltime',
        auto: true,
        gen: this.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    if (this.rotate) {
      defIndex.push({
        key: '__timestamp',
        auto: true,
        gen: this.genCache['autoTimestamp'],
        unique: false,
        sparse: false,
        required: true,
      })
    }

    this._buildIndex(
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
    this.ensureIndexes()
  }

  reset() {
    this.list.length = 0
    this.indexes = {}
    this.ensureIndexes()
  }

  async load(name?: string): Promise<void> {
    try {
      const stored = await this.storage.restore(name)
      if (stored) {
        const { indexes, list, indexDefs, id, ttl } = stored
        this.list.load(list)
        this.indexDefs = this.restoreIndex(indexDefs)
        this.id = id
        this.ttl = ttl

        this.inserts = []
        this.removes = []
        this.updates = []
        this.ensures = []

        this.indexes = {}
        this._buildIndex(this.indexDefs)
        this.indexes = indexes
        this.ensureIndexes()
      }
    } catch (e) {
      // throw e
    }
    this.ensureTTL()
  }

  ensureTTL() {
    if (this.ttl) {
      // ensure that all object are actuated with time
      const now = Date.now()
      for (const i of this.list.keys) {
        const item = this.list.get(i)
        if (now - item.__ttltime >= this.ttl) {
          this.removeWithId(item[this.id])
        }
      }
      this.persist()
    }
  }

  doRotate() {
    if (this.list.length > 0) {
      const collection = this.clone(true)
      collection.persist(`${this.model}${new Date().toUTCString()}`)
      this.reset()
      this.persist()
    }
  }

  cleanupIndexes() {
    Object.keys(this.indexDefs).forEach((i) => {
      const index = this.indexDefs[i]
      if (!index.unique) {
        const entries = this.indexes[index.key as string]
        Object.keys(entries).forEach((key) => {
          const entry = entries[key]
          if (Array.isArray(entry)) {
            if (entry.length == 0) {
              unset(entries, key)
            }
          }
        })
      }
    })
  }

  store() {
    return {
      list: this.list.persist(),
      indexes: this.indexes,
      indexDefs: this.storeIndex(this.indexDefs),
      id: this.id,
      ttl: this.ttl,
    }
  }

  async persist(name?: string): Promise<void> {
    this.cleanupIndexes()
    await this.storage.store(name)
  }

  restoreIndex(input: Dictionary<IndexStored<T>>): Dictionary<IndexDef<T>> {
    return _.map(input, (index) => {
      return this.restoreIndexDef(index)
    }).reduce((res, cur) => {
      res[cur.key as string] = cur
      return res
    }, {})
  }

  storeIndex(input: Dictionary<IndexDef<T>>): Dictionary<IndexStored<T>> {
    return _.map(input, (index) => {
      return this.storeIndexDef(index)
    }).reduce((res, cur) => {
      res[cur.key as string] = cur
      return res
    }, {})
  }

  storeIndexDef<T>(input: IndexDef<T>): IndexStored<T> {
    const { key, auto, unique, sparse, required, ignoreCase } = input
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
        ? input.process.toString()
        : undefined,
      gen: input.gen
        ? this.genCache[input.gen.name]
          ? input.gen.name
          : input.gen.toString()
        : undefined,
    }
  }

  restoreIndexDef<T>(input: IndexStored<T>): IndexDef<T> {
    const {
      key,
      type = 'string',
      auto,
      unique,
      sparse,
      required,
      ignoreCase,
    } = input
    return {
      key,
      type,
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

  _buildIndex(indexList: Dictionary<IndexDef<T>>) {
    for (const key in indexList) {
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
        gen = this.genCache['autoIncIdGen']
      }
      if (ignoreCase) {
        process = (value: any) =>
          value?.toString ? value.toString().toLowerCase() : value
      }

      if (!key) {
        throw new Error(`key is required field for index`)
      }

      this.indexDefs[key] = {
        key,
        auto,
        unique,
        gen,
        sparse,
        required,
        ignoreCase,
        process,
      }

      if (this.indexes.hasOwnProperty(key)) {
        throw new Error(`index with key ${key} already exists`)
      }

      const validate = (value) => {
        if (!(sparse && value == null)) {
          if (required && value == null) {
            throw new Error(
              `value for index ${key} is required, but ${value} is met`,
            )
          }
          if (
            unique &&
            this.indexes.hasOwnProperty(key) &&
            this.indexes[key].hasOwnProperty(value)
          ) {
            throw new Error(
              `unique index ${key} already contains value ${value}`,
            )
          }
        }
      }

      const ensureValue = (item: T) => {
        let value = get(item, key)
        if (value == null && auto) {
          set(item, key, (value = gen(item, this.model, this.list)))
        }
        if (process) {
          value = process(value)
        }
        return value
      }

      const getValue = (item) => {
        let value = get(item, key)
        if (process) {
          value = process(value)
        }
        return value
      }

      this.ensures.push(() => {
        if (!this.indexes.hasOwnProperty(key)) {
          this.indexes[key] = {}
        }
      })

      if (unique) {
        this.inserts.push((item) => {
          const value = ensureValue(item)
          validate(value)
          if (!(sparse && value == null)) {
            return (i) => (this.indexes[key][value] = i)
          }
        })

        this.updates.push((ov, nv, i) => {
          const valueOld = ensureValue(ov)
          const valueNew = getValue(nv)
          if (valueNew != null) {
            validate(valueNew)
            if (valueOld !== valueNew) {
              unset(this.indexes[key], valueOld)
              this.indexes[key][valueNew] = i
            }
          }
        })

        this.removes.push((item, i) => {
          unset(this.indexes[key], get(item, key))
        })
      } else {
        this.inserts.push((item) => {
          const value = ensureValue(item)
          validate(value)
          if (!(sparse && value == null)) {
            if (!this.indexes[key].hasOwnProperty(value)) {
              this.indexes[key][value] = []
            }
            return (i) => (this.indexes[key][value] as Array<number>).push(i)
          }
        })

        this.updates.push((ov, nv, i) => {
          const valueOld = ensureValue(ov)
          const valueNew = getValue(nv)
          if (valueNew != null) {
            validate(valueNew)
            if (valueOld !== valueNew) {
              const items = this.indexes[key][valueOld] as Array<number>
              if (items) {
                items.splice(items.indexOf(i), 1)
                items.push(i)
              }
            }
          }
        })

        this.removes.push((item, i) => {
          const items = this.indexes[key][get(item, key)] as Array<number>
          if (items) {
            items.splice(items.indexOf(i), 1)
            if (items.length == 0) {
              unset(this.indexes[key], get(item, key))
            }
          }
        })
      }
    }
  }

  ensureIndexes() {
    this.ensures.forEach((ensure) => ensure())
  }

  prepareIndexInsert(val) {
    const result = this.inserts.map((item) => item(val))
    return (i) => {
      result.filter((f) => typeof f == 'function').forEach((f) => f(i))
    }
  }

  updateIndex(ov, nv, i) {
    this.updates.forEach((item) => item(ov, nv, i))
  }

  removeIndex(val, i) {
    this.removes.forEach((item) => item(val, i))
  }

  push(item) {
    const insert = this.prepareIndexInsert(item)
    this.list.push(item)
    insert(this.list.counter - 1)
  }

  _traverse(condition: Partial<T> | ((T) => boolean), action) {
    const condFunction = condition instanceof Function
    const count = condFunction ? 1 : Object.keys(condition).length

    for (const i of this.list.keys) {
      let mc = 0
      const current = this.list.get(i)
      if (condition instanceof Function) {
        const comp = condition(current)
        if (comp) {
          mc++
        }
      } else {
        for (const m in condition) {
          if (condition[m] == current[m]) {
            mc++
          } else {
            break
          }
        }
      }
      if (mc == count) {
        const next = action(i, current)
        if (!next) {
          break
        }
      }
    }
  }

  create(item: T): T {
    const res = { ...item } as T
    this.push(res)
    return res
  }

  findById(id): T {
    const { process } = this.indexDefs[this.id]
    if (process) {
      id = process(id)
    }
    const result = this.list.get(this.indexes[this.id][id] as number | string)
    return this.returnOneIfValid(result)
  }

  findBy(key: Paths<T>, id): Array<T> {
    const { process } = this.indexDefs[key as string]
    if (process) {
      id = process(id)
    }

    const result = []
    if (this.indexDefs.hasOwnProperty(key)) {
      result.push(...this.getIndexedValue(key, id))
    }
    return this.returnListIfValid(result)
  }

  private getIndexedValue(key: Paths<T>, value: any) {
    const result = []
    if (this.indexes[key as string]?.hasOwnProperty(value)) {
      const index = this.indexes[key as string][value]
      if (Array.isArray(index)) {
        ;(this.indexes[key as string][value] as Array<number>).forEach((i) =>
          result.push(this.list.get(i)),
        )
      } else {
        result.push(this.list.get(index))
      }
    }
    return this.returnListIfValid(result)
  }

  query(filter) {}

  find(condition): Array<T> {
    const result = []
    this._traverse(condition, (i, cur) => {
      result.push(cur)
      return true
    })
    return this.returnListIfValid(result)
  }

  findOne(condition): T {
    let result
    this._traverse(condition, (i, cur) => {
      result = cur
    })
    return this.returnOneIfValid(result)
  }

  isValidTTL(item?: T) {
    if (item) {
      if (item.__ttltime) {
        const now = Date.now()
        return now - item.__ttltime <= this.ttl
      } else {
        return true
      }
    } else {
      return false
    }
  }

  returnOneIfValid(result?: T) {
    if (result) {
      let invalidate = false

      if (result && !this.isValidTTL(result)) {
        invalidate = true
      }
      if (invalidate) {
        if (this.ttl && this.list.length > 0) {
          setImmediate(() => {
            this.ensureTTL()
          })
        }
      }
      return invalidate ? undefined : result
    } else {
      return result
    }
  }

  returnListIfValid(items?: Array<T>) {
    let invalidate = false

    const result = items.filter((i) => {
      if (this.isValidTTL(i)) {
        return true
      } else {
        invalidate = true
        return false
      }
    })

    if (invalidate) {
      if (this.ttl && this.list.length > 0) {
        setImmediate(() => {
          this.ensureTTL()
        })
      }
    }
    return invalidate ? result : result
  }

  update(condition, update: Partial<T>) {
    this._traverse(condition, (i, cur) => {
      this.updateIndex(cur, update, i)
      for (const u in update) {
        cur[u] = update[u]
      }
      return true
    })
  }

  updateOne(condition, update: Partial<T>) {
    this._traverse(condition, (i, cur) => {
      this.updateIndex(cur, update, i)
      for (const u in update) {
        cur[u] = update[u]
      }
    })
  }

  updateWithId(id, update: Partial<T>) {
    const result = this.findById(id)
    this.updateIndex(result, update, id)
    _.assign(result, update)
  }

  removeWithId(id) {
    const i = this.indexes[this.id][id] as number | string
    const cur = this.list.get(i)
    if (~i && cur) {
      this.removeIndex(cur, i)
      this.list.remove(i)
    }
  }

  remove(condition) {
    this._traverse(condition, (i, cur) => {
      this.removeIndex(cur, i)
      this.list.remove(i)
      return true
    })
  }

  removeOne(condition) {
    this._traverse(condition, (i, cur) => {
      this.removeIndex(cur, i)
      this.list.remove(i)
    })
  }
}

// возможно не работает TTL не удаляются значения индекса.
