// import fs from 'fs-extra';
import tp from 'timeparse';
import _, { get, set, unset } from 'lodash'
import { autoIncIdGen } from './autoIncIdGen';
import { autoTimestamp } from './autoTimestamp';
import { StorageAdapter } from './StorageAdapter';
import { List } from './List';
import { IndexDef } from './IndexDef';
import { Item } from './Item';
import { IdGeneratorFunction } from './IdGeneratorFunction';
import { IdType } from './IdType';
import { CollectionConfig } from './CollectionConfig';
import AdapterFile from './adapter-fs';
import { CronJob } from 'cron'
export default class Collection<T extends Item> {
  cronJob?: CronJob
  storage: StorageAdapter<T>;
  ttl: number;
  /** cron tab time */
  rotate: string;
  model: string;
  id: string;
  auto: boolean;
  indexes: { [index: string]: { [key: string]: number | object | Array<number> } }
  list: List<T>

  inserts: Array<(item: T) => (i: number) => void>
  updates: Array<(ov: T, nv: T, i: any) => void>
  removes: Array<(item: T, i: any) => void>
  ensures: Array<() => void>
  indexDefs: { [name: string]: IndexDef }
  genCache: { [key: string]: IdGeneratorFunction<T> }

  clone(withData?: boolean) {
    let collection = new Collection<T>({ name: this.model, adapter: this.storage.clone() })

    collection.indexDefs = this.indexDefs
    collection.id = this.id
    collection.ttl = this.ttl

    collection.inserts = [];
    collection.removes = [];
    collection.updates = [];
    collection.ensures = [];

    collection.indexes = {};
    collection._buildIndex(collection.indexDefs);
    collection.ensureIndexes();
    if (withData) {
      this.list.toArray().forEach(i => collection.push(i))
    }
    return collection;
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
      adapter = new AdapterFile(path)
    } = config ?? {};

    if (rotate) {
      this.cronJob = new CronJob(rotate, () => {
        this.doRotate()
      })
      this.cronJob.start();
    }

    this.storage = adapter.init(this)
    let Id: Partial<IdType<T>> = typeof id == "string" ? { name: id } : id;

    if ('string' == typeof id) {
      Id = {
        name: id,
        auto: (typeof auto != 'undefined') ? auto : true,
        gen: idGen || 'autoIncIdGen',
      };

    } else if (id instanceof Function) {
      Id = id();
    }

    if (!Id.name) {
      Id.name = 'id';
    }

    if (Id.auto) {
      Id.auto = (auto == null) ? auto : true;
    }

    if (Id.gen == null) {
      Id.gen = idGen || 'autoIncIdGen';
    }

    if (!name) {
      throw new Error('must Have Model Name as "model" prop in config');
    }

    this.ttl = (typeof ttl == 'string' ? tp(ttl) : ttl) || false;
    this.rotate = rotate;
    this.model = name;
    this.id = Id.name;
    this.auto = Id.auto;
    this.indexes = {};
    this.list = new List();
    this.indexDefs = {};
    this.inserts = [];
    this.removes = [];
    this.updates = [];
    this.ensures = [];

    this.genCache = {
      autoIncIdGen: autoIncIdGen,
      autoTimestamp: autoTimestamp,
    };

    let defIndex: IndexDef[] = [{
      key: this.id,
      auto: this.auto,
      gen: typeof Id.gen == 'function' ? Id.gen.toString() : Id.gen,
      unique: true,
      sparse: false,
      required: true,
    }];

    if (this.ttl) {
      defIndex.push({
        key: '__ttltime',
        auto: true,
        gen: 'autoTimestamp',
        unique: false,
        sparse: false,
        required: true,
      });
    }

    if (this.rotate) {
      defIndex.push({
        key: '__timestamp',
        auto: true,
        gen: 'autoTimestamp',
        unique: false,
        sparse: false,
        required: true,
      });
    }

    this._buildIndex(defIndex.concat(indexList || []).reduce((prev, curr) => {
      prev[curr.key] = {
        key: curr.key,
        auto: curr.auto || false,
        unique: curr.unique || false,
        gen: curr.gen || 'autoIncIdGen',
        sparse: curr.sparse || false,
        required: curr.required || false,
      };
      return prev;
    }, {} as IndexDef[]));
    this.ensureIndexes();
  }

  reset() {
    this.list.length = 0;
    this.indexes = {};
    this.ensureIndexes();
  }

  async load(name?: string): Promise<void> {
    try {
      const stored = await this.storage.restore(name)
      if (stored) {
        let { indexes, list, indexDefs, id, ttl } = stored;
        this.list.load(list);
        this.indexDefs = indexDefs;
        this.id = id;
        this.ttl = ttl;

        this.inserts = [];
        this.removes = [];
        this.updates = [];
        this.ensures = [];

        this.indexes = {};
        this._buildIndex(indexDefs);
        this.indexes = indexes;
        this.ensureIndexes();
      }
    } catch (e) {
      // throw e
    }
    this.ensureTTL();
  }

  ensureTTL() {
    if (this.ttl) {
      // ensure that all object are actuated with time
      let now = Date.now();
      for (let i of this.list.keys) {
        let item = this.list.get(i);
        if ((now - item.__ttltime) >= this.ttl) {
          this.removeWithId(item[this.id]);
        }
      }
      this.persist();
    }
  }

  doRotate() {
    if (this.list.length > 0) {
      let collection = this.clone(true)
      collection.persist(`${this.model}${(new Date()).toUTCString()}`)
      this.reset();
      this.persist();
    }
  }

  cleanupIndexes() {
    Object.keys(this.indexDefs).forEach(i => {
      let index = this.indexDefs[i];
      if (!index.unique) {
        let entries = this.indexes[index.key];
        Object.keys(entries).forEach(key => {
          let entry = entries[key]
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
      indexDefs: this.indexDefs,
      id: this.id,
      ttl: this.ttl,
    }
  }

  async persist(name?: string): Promise<void> {
    this.cleanupIndexes()
    await this.storage.store(name);
  }

  restoreIndex() {
    for (let key in this.indexDefs) {
      let gen = this.indexDefs[key].gen;
      this.genCache[gen] = eval(gen);
    }
  }

  _buildIndex(indexList) {
    for (let key in indexList) {
      let {
        auto = false,
        unique = false,
        gen = 'autoIncIdGen',
        sparse = false,
        required = false,
      } = indexList[key];

      if (typeof gen == 'function') {
        this.genCache[gen.toString()] = gen;
        gen = gen.toString();
      }

      if (!key) {
        throw new Error(`key is required field for index`);
      }

      this.indexDefs[key] = {
        key,
        auto,
        unique,
        gen,
        sparse,
        required,
      };

      if (this.indexes.hasOwnProperty(key)) {
        throw new Error(`index with key ${key} already exists`);
      }

      let validate = (value) => {
        if (!(sparse && value == null)) {
          if (required && value == null) {
            throw new Error(`value for index ${key} is required, but ${value} is met`);
          }
          if (unique && this.indexes.hasOwnProperty(key) && this.indexes[key].hasOwnProperty(value)) {
            throw new Error(`unique index ${key} already contains value ${value}`);
          }
        }
      };

      let ensureValue = (item: T) => {
        let value = get(item, key);
        if ((value == null) && auto) {
          set(item, key, value = this.genCache[gen](item, this.model, this.list));
        }
        return value;
      };

      let getValue = (item) => {
        return get(item, key);
      };

      this.ensures.push(() => {
        if (!this.indexes.hasOwnProperty(key)) {
          this.indexes[key] = {};
        }
      });

      if (unique) {
        this.inserts.push((item) => {
          let value = ensureValue(item);
          validate(value);
          if (!(sparse && value == null)) {
            return (i) => this.indexes[key][value] = i;
          }
        });

        this.updates.push((ov, nv, i) => {
          let valueOld = ensureValue(ov);
          let valueNew = getValue(nv);
          if (valueNew != null) {
            validate(valueNew);
            if (valueOld !== valueNew) {
              unset(this.indexes[key], valueOld)
              this.indexes[key][valueNew] = i;
            }
          }
        });

        this.removes.push((item, i) => {
          unset(this.indexes[key], get(item, key));
        });

      } else {

        this.inserts.push((item) => {
          let value = ensureValue(item);
          validate(value);
          if (!(sparse && value == null)) {
            if (!this.indexes[key].hasOwnProperty(value)) {
              this.indexes[key][value] = [];
            }
            return (i) => (this.indexes[key][value] as Array<number>).push(i);
          }
        });

        this.updates.push((ov, nv, i) => {
          let valueOld = ensureValue(ov);
          let valueNew = getValue(nv);
          if (valueNew != null) {
            validate(valueNew);
            if (valueOld !== valueNew) {
              let items = this.indexes[key][valueOld] as Array<number>;
              if (items) {
                items.splice(items.indexOf(i), 1);
                items.push(i);
              }
            }
          }
        });

        this.removes.push((item, i) => {
          let items = this.indexes[key][get(item, key)] as Array<number>;
          if (items) {
            items.splice(items.indexOf(i), 1);
            if (items.length == 0) {
              unset(this.indexes[key], get(item, key))
            }
          }
        });
      }
    }
  }

  ensureIndexes() {
    this.ensures.forEach(ensure => ensure());
  }

  prepareIndexInsert(val) {
    let result = this.inserts.map(item => item(val));
    return (i) => {
      result
        .filter(f => typeof f == "function")
        .forEach(f => f(i));
    };
  }

  updateIndex(ov, nv, i) {
    this.updates.forEach(item => item(ov, nv, i));
  }

  removeIndex(val, i) {
    this.removes.forEach(item => item(val, i));
  }

  push(item) {
    let insert = this.prepareIndexInsert(item);
    this.list.push(item);
    insert(this.list.counter - 1);
  }

  _traverse(condition, action) {
    let condFunction = condition instanceof Function;
    const count = condFunction ? 1 : Object.keys(condition).length;

    for (let i of this.list.keys) {
      let mc = 0;
      let current = this.list.get(i);
      if (condFunction) {
        let comp = condition(current);
        if (comp) {
          mc++;
        }
      } else {
        for (let m in condition) {
          if (condition[m] == current[m]) {
            mc++;
          } else {
            break;
          }
        }
      }
      if (mc == count) {
        let next = action(i, current);
        if (!next) {
          break;
        }
      }
    }
  }

  create(item): T {
    let res = { ...item } as T;
    this.push(res);
    return res;
  }

  findById(id): T {
    const result = this.list.get(this.indexes[this.id][id] as number | string)
    return this.returnOneIfValid(result)
  }

  findBy(key, id): Array<T> {
    let result = [];
    if (this.indexDefs.hasOwnProperty(key)) {
      if (this.indexDefs[key].unique) {
        result = [this.list.get(this.indexes[key][id] as number | string)];
      } else {
        if (this.indexes[key].hasOwnProperty(id)) {
          result = (this.indexes[key][id] as Array<number>).map((i) => this.list.get(i));
        }
      }
    }

    return this.returnListIfValid(result);
  }

  query(filter) {

  }

  find(condition): Array<T> {
    const result = [];
    this._traverse(condition, (i, cur) => {
      result.push(cur);
      return true;
    })
    return this.returnListIfValid(result);
  }

  findOne(condition): T {
    let result;
    this._traverse(condition, (i, cur) => {
      result = cur;
    });
    return this.returnOneIfValid(result);
  }

  isValidTTL(item?: T) {
    if (item) {
      if (item.__ttltime) {
        let now = Date.now();
        return (now - item.__ttltime) <= this.ttl
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  returnOneIfValid(result?: T) {
    if (result) {
      let invalidate = false

      if (result && !this.isValidTTL(result)) {
        invalidate = true;
      }
      if (invalidate) {
        if (this.ttl && this.list.length > 0) {
          setImmediate(() => {
            this.ensureTTL()
          })
        }
      }
      return invalidate ? undefined : result;
    } else {
      return result;
    }
  }

  returnListIfValid(items?: Array<T>) {
    let invalidate = false

    let result = items.filter(i => {
      if (this.isValidTTL(i)) {
        return true;
      } else {
        invalidate = true;
        return false
      }
    });

    if (invalidate) {
      if (this.ttl && this.list.length > 0) {
        setImmediate(() => {
          this.ensureTTL()
        })
      }
    }
    return invalidate ? result : result;
  }

  update(condition, update) {
    this._traverse(condition, (i, cur) => {
      this.updateIndex(cur, update, i);
      for (let u in update) {
        cur[u] = update[u];
      }
      return true;
    });
  }

  updateOne(condition, update) {
    this._traverse(condition, (i, cur) => {
      this.updateIndex(cur, update, i);
      for (let u in update) {
        cur[u] = update[u];
      }
    });
  }

  updateWithId(id, update) {
    let result = this.findById(id);
    this.updateIndex(result, update, id);
    _.assign(result, update)
  }

  removeWithId(id) {
    let i = this.indexes[this.id][id] as number | string;
    let cur = this.list.get(i);
    if (~i && cur) {
      this.removeIndex(cur, i);
      this.list.remove(i);
    }
  }

  remove(condition) {
    this._traverse(condition, (i, cur) => {
      this.removeIndex(cur, i);
      this.list.remove(i);
      return true;
    });
  }

  removeOne(condition) {
    this._traverse(condition, (i, cur) => {
      this.removeIndex(cur, i);
      this.list.remove(i);
    });
  }
}

// возможно не работает TTL не удаляются значения индекса.
