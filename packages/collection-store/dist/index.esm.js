// src/AdapterFile.ts
import pathLib from "path";
import fs from "fs-extra";

class AdapterFile {
  get name() {
    return "AdapterFile";
  }
  get file() {
    if (this.collection.list.singlefile) {
      return pathLib.join(this.collection.root, `${this.collection.name}.json`);
    }
    return pathLib.join(this.collection.root, this.collection.name, "metadata.json");
  }
  collection;
  clone() {
    return new AdapterFile;
  }
  init(collection2) {
    this.collection = collection2;
    return this;
  }
  async restore(name2) {
    let path = this.file;
    if (name2) {
      const p = { ...pathLib.parse(this.file) };
      p.name = name2;
      delete p.base;
      path = pathLib.format(p);
    }
    if (fs.pathExistsSync(path)) {
      return fs.readJSON(path);
    }
    return false;
  }
  async store(name2) {
    let path = this.file;
    if (name2) {
      const p = { ...pathLib.parse(this.file) };
      p.name = name2;
      delete p.base;
      path = pathLib.format(p);
    }
    await fs.ensureFile(path);
    await fs.writeJSON(path, this.collection.store(), {
      spaces: 2
    });
  }
}

// src/timeparse.ts
var units = {
  μs: 1,
  ms: 1000,
  s: 1000 * 1000,
  m: 1000 * 1000 * 60,
  h: 1000 * 1000 * 60 * 60,
  d: 1000 * 1000 * 60 * 60 * 24,
  w: 1000 * 1000 * 60 * 60 * 24 * 7
};
function parse(str, returnUnit = "ms") {
  let totalMicroseconds = 0;
  const groups = str.toLowerCase().match(/[-+]?[0-9\.]+[a-z]+/g);
  if (groups !== null) {
    for (const g of groups) {
      const value = parseFloat(g.match(/[0-9\.]+/g)[0]);
      const unit = g.match(/[a-z]+/g)[0];
      totalMicroseconds += getMicroseconds(value, unit);
    }
  }
  return totalMicroseconds / units[returnUnit];
}
function getMicroseconds(value, unit) {
  const result = units[unit];
  if (result) {
    return value * result;
  }
  throw new Error(`The unit "${unit}" could not be recognized`);
}

// src/collection.ts
import * as _3 from "lodash-es";

// src/utils/autoIncIdGen.ts
function autoIncIdGen(item, model, list2) {
  return list2.counter;
}

// src/utils/autoTimestamp.ts
function autoTimestamp(item, model, list2) {
  return Date.now();
}

// src/types/Item.ts
import { z } from "zod";
var ItemSchema = z.object({
  __ttltime: z.number().optional(),
  id: z.union([z.number(), z.string()]).optional()
}).passthrough();

// src/collection.ts
import { CronJob } from "cron";

// src/query/$and.ts
function $and(value) {
  return (val) => {
    for (const condition of value) {
      for (const prop of Object.keys(condition))
        if (!condition[prop](val[prop])) {
          return false;
        }
    }
    return true;
  };
}

// src/utils/get_value_of.ts
function get_value_of(v) {
  if (typeof v === "object" && v !== null && "valueOf" in v && typeof v.valueOf === "function") {
    return v.valueOf();
  } else {
    return v;
  }
}

// src/query/$eq.ts
function $eq(value) {
  const val = get_value_of(value);
  if (val === undefined)
    return (v) => false;
  return (v) => val === get_value_of(v);
}

// src/query/$every.ts
function $every(value) {
  if (value === undefined)
    return (_) => false;
  return (v) => v.map(get_value_of).every(value);
}

// src/query/$exists.ts
function $exists(value) {
  return (val) => {
    const res2 = val !== undefined && val !== null && val !== "";
    return value ? res2 : !res2;
  };
}

// src/query/$gt.ts
function $gt(value) {
  const val = get_value_of(value);
  if (val === undefined)
    return (_) => false;
  return (v) => get_value_of(v) > val;
}

// src/query/$gte.ts
function $gte(value) {
  const val = get_value_of(value);
  if (val === undefined)
    return (_) => false;
  return (v) => get_value_of(v) >= (value ?? 0);
}

// src/query/$in.ts
function $in(value) {
  if (value === undefined)
    return (_) => false;
  const val = value.map(get_value_of);
  return (v) => val.includes(get_value_of(v));
}

// src/query/$lt.ts
function $lt(value) {
  const val = get_value_of(value);
  if (val === undefined)
    return (_) => false;
  return (v) => get_value_of(v) < (value ?? 0);
}

// src/query/$lte.ts
function $lte(value) {
  const val = get_value_of(value);
  if (val === undefined)
    return (_) => false;
  return (v) => get_value_of(v) <= (value ?? 0);
}

// src/query/$match.ts
function $match(value, flags) {
  if (typeof value === "object") {
    return (val) => value.test(val);
  }
  const reg = new RegExp(value, flags);
  return (val) => reg.test(val);
}

// src/query/$ne.ts
function $ne(value) {
  const val = get_value_of(value);
  if (val === undefined)
    return (_) => false;
  return (v) => get_value_of(v) !== val;
}

// src/query/$nin.ts
function $nin(value) {
  if (value === undefined)
    return (_) => false;
  const val = value.map(get_value_of);
  return (v) => !val.includes(get_value_of(v));
}

// src/query/$or.ts
function $or(value) {
  return (val) => {
    for (const condition of value) {
      for (const prop of Object.keys(condition)) {
        if (condition[prop](val[prop])) {
          return true;
        }
      }
    }
    return false;
  };
}

// src/query/$size.ts
function $size(value) {
  return (val) => val.length === value;
}

// src/query/$some.ts
function $some(value) {
  if (value === undefined)
    return (_) => false;
  return (v) => v.map(get_value_of).some(value);
}

// src/query/build_query.ts
function build_query(_obj, options) {
  const res2 = [];
  if (typeof _obj === "object" && !(_obj instanceof Date) && _obj) {
    const obj = _obj;
    const keys = Object.keys(obj);
    for (const prop of keys) {
      if (options?.[prop]) {
        res2.push(options[prop](obj[prop]));
      } else {
        switch (prop) {
          case "$eq":
            res2.push($eq(obj.$eq));
            break;
          case "$gt":
            res2.push($gt(obj.$gt));
            break;
          case "$gte":
            res2.push($gte(obj.$gte));
            break;
          case "$lt":
            res2.push($lt(obj.$lt));
            break;
          case "$lte":
            res2.push($lte(obj.$lte));
            break;
          case "$ne":
            res2.push($ne(obj.$ne));
            break;
          case "$in":
            res2.push($in(obj.$in));
            break;
          case "$nin":
            res2.push($nin(obj.$nin));
            break;
          case "$some":
            res2.push($some(obj.$some));
            break;
          case "$every":
            res2.push($every(obj.$every));
            break;
          case "$exists":
            res2.push($exists(obj.$exists));
            break;
          case "$match":
            res2.push($match(obj.$match, "g"));
            break;
          case "$imatch":
            res2.push($match(obj.$imatch, "ig"));
            break;
          case "$size":
            res2.push($size(obj.$size));
            break;
          case "$and":
            res2.push($and(obj.$and));
            break;
          case "$or":
            res2.push($or(obj.$or));
            break;
          default:
            res2.push({ [prop]: build_query(obj[prop], options) });
        }
      }
    }
    if (res2.length === 1) {
      return res2[0];
    }
    return options?.$and(res2) ?? $and(res2);
  }
  if (typeof _obj === "number" || typeof _obj === "bigint" || typeof _obj === "string" || _obj instanceof Date) {
    return $eq(_obj);
  }
  throw new Error("unknown type");
}

// src/query/query.ts
function query(obj, options) {
  const q = build_query(obj, options);
  if (typeof q === "object") {
    return $and(Object.keys(q).reduce((res2, key2) => {
      res2.push({ [key2]: q[key2] });
      return res2;
    }, []));
  }
  if (typeof q === "function") {
    return q;
  }
  throw new Error("nonsense");
}

// src/iterators/last.ts
async function* last(collection2, condition) {
  if (typeof condition == "object")
    condition = query(condition);
  for await (const current of collection2.list.backward) {
    if (condition(current)) {
      yield current;
      return;
    }
  }
}

// src/iterators/first.ts
async function* first(collection2, condition) {
  if (typeof condition == "object")
    condition = query(condition);
  for await (const current of collection2.list.forward) {
    if (condition(current)) {
      yield current;
      return;
    }
  }
}

// src/iterators/all.ts
async function* all(collection2, condition) {
  if (typeof condition == "object")
    condition = query(condition);
  for await (const current of collection2.list.forward) {
    if (condition(current)) {
      yield current;
    }
  }
}

// src/collection/prepare_index_insert.ts
function prepare_index_insert(collection2, val) {
  const result = [];
  for (let i = 0;i < collection2.inserts?.length; i += 1) {
    result.push(collection2.inserts[i](val));
  }
  return (i) => {
    result.forEach((f) => f?.(i));
  };
}

// src/collection/update_index.ts
async function update_index(collection2, ov, nv, i) {
  await Promise.all(collection2.updates.map((item) => item(ov, nv, i)));
}

// src/collection/ensure_ttl.ts
async function ensure_ttl(collection2) {
  if (collection2.ttl) {
    const now = Date.now();
    const cutoffTime = now - collection2.ttl;
    const ttlIndex = collection2.indexes[ttl_key];
    if (!ttlIndex)
      return;
    const expiredItems = [];
    const expiredGenerator = ttlIndex.lt(cutoffTime)(ttlIndex);
    let cursor = expiredGenerator.next();
    while (!cursor.done && cursor.value) {
      if (cursor.value.value !== undefined) {
        expiredItems.push(cursor.value.value);
      }
      cursor = expiredGenerator.next();
    }
    for (const itemId of expiredItems) {
      await collection2.removeWithId(itemId);
    }
    if (expiredItems.length > 0) {
      await collection2.persist();
    }
  }
}

// src/collection/remove_index.ts
function remove_index(collection2, val) {
  collection2.removes.forEach((item) => item(val));
}

// src/collection/create_index.ts
import { get as get3 } from "lodash-es";
import { BPlusTree } from "b-pl-tree";

// src/collection/ensure_indexed_value.ts
import { get, set } from "lodash-es";
function ensure_indexed_value(item, key2, collection2, gen, auto2, process) {
  let value = get(item, key2);
  if (value == null && auto2) {
    value = gen?.(item, collection2.name, collection2.list) ?? value;
    set(item, key2, value);
  }
  if (process) {
    value = process(value);
  }
  return value;
}

// src/collection/get_value.ts
import { get as get2 } from "lodash-es";
function get_value(item, key2, process) {
  let value = get2(item, key2);
  if (process) {
    value = process(value);
  }
  return value;
}

// src/collection/validate_indexed_value_for_insert.ts
function validate_indexed_value_for_insert(collection2, value, key2, sparse2, required2, unique2) {
  if (!(sparse2 && value == null)) {
    if (required2 && value == null) {
      return [false, `value for index ${key2} is required, but ${value} is met`];
    }
    if (unique2 && collection2.indexes.hasOwnProperty(key2) && collection2.indexes[key2].findFirst(value) !== undefined) {
      return [false, `unique index ${key2} already contains value ${value}`];
    }
  }
  return [true];
}

// src/collection/validate_indexed_value_for_update.ts
async function validate_indexed_value_for_update(collection2, value, key2, sparse2, required2, unique2, id2) {
  if (!(sparse2 && value == null)) {
    if (required2 && value == null) {
      return [false, `value for index ${key2} is required, but ${value} is met`];
    }
    if (unique2 && collection2.indexes.hasOwnProperty(key2)) {
      const existingPosition = collection2.indexes[key2].findFirst(value);
      if (existingPosition !== undefined) {
        const existingItem = await collection2.list.get(existingPosition);
        if (existingItem && existingItem[collection2.id] !== id2) {
          return [false, `unique index ${key2} already contains value ${value}`];
        }
      }
    }
  }
  return [true];
}

// src/collection/ensure_indexes.ts
async function ensure_indexes(collection2) {
  for (const ensure of collection2.ensures) {
    ensure();
  }
}

// src/collection/create_index.ts
function create_index(collection2, key2, indexDef) {
  const {
    auto: auto2 = false,
    unique: unique2 = false,
    sparse: sparse2 = false,
    required: required2 = false,
    ignoreCase: ignoreCase2
  } = indexDef;
  let { gen, process } = indexDef;
  if (auto2 && !gen) {
    gen = Collection.genCache["autoIncIdGen"];
  }
  if (ignoreCase2) {
    process = (value) => value?.toString ? value.toString().toLowerCase() : value;
  }
  if (!key2) {
    throw new Error(`key is required field for index`);
  }
  collection2.indexDefs[key2] = {
    key: key2,
    auto: auto2,
    unique: unique2,
    gen,
    sparse: sparse2,
    required: required2,
    ignoreCase: ignoreCase2,
    process
  };
  if (collection2.indexes.hasOwnProperty(key2)) {
    throw new Error(`index with key ${key2} already exists`);
  }
  const insert = key2 !== "*" ? (item) => {
    const value = ensure_indexed_value(item, key2, collection2, gen, auto2, process);
    const [valid, message] = validate_indexed_value_for_insert(collection2, value, key2, sparse2, required2, unique2);
    if (!valid)
      throw new Error(message);
    if (!(sparse2 && value == null)) {
      return (record_link) => collection2.indexes[key2].insert(value !== undefined ? value : null, record_link);
    }
  } : (item) => {
    let found = false;
    const newIndexDefs = Object.keys(item).reduce((res2, pname) => {
      if (!collection2.indexDefs[pname]) {
        found = true;
        res2[pname] = {
          ...collection2.indexDefs["*"],
          key: pname
        };
      }
      return res2;
    }, {});
    if (found) {
      collection2.indexDefs = {
        ...collection2.indexDefs,
        ...newIndexDefs
      };
      build_indexes(collection2, newIndexDefs);
      ensure_indexes(collection2);
    }
    return (record_link) => {
      return;
    };
  };
  const update = key2 !== "*" ? async (ov, nv, index_payload) => {
    const valueOld = ensure_indexed_value(ov, key2, collection2, gen, auto2, process);
    const valueNew = get_value(nv, key2, process);
    if (valueNew != null) {
      const [valid, message] = await validate_indexed_value_for_update(collection2, valueNew, key2, sparse2, required2, unique2, ov[collection2.id]);
      if (!valid)
        throw new Error(message);
      if (valueOld !== valueNew) {
        if (unique2) {
          collection2.indexes[key2].remove(valueOld);
        } else {
          collection2.indexes[key2].removeSpecific(valueOld, (pointer) => key2 != collection2.id ? pointer == ov[collection2.id] : true);
        }
        collection2.indexes[key2].insert(valueNew !== undefined ? valueNew : null, index_payload);
      }
    } else {
      if (unique2) {
        collection2.indexes[key2].remove(valueOld);
      } else {
        collection2.indexes[key2].removeSpecific(valueOld, (pointer) => key2 != collection2.id ? pointer == ov[collection2.id] : true);
      }
    }
  } : undefined;
  const remove = key2 !== "*" ? (item) => {
    console.log(key2, collection2.indexes[key2].removeSpecific(get3(item, key2) ?? null, (pointer) => key2 != collection2.id ? pointer == item[collection2.id] : true));
  } : undefined;
  const ensure = key2 !== "*" ? () => {
    if (!collection2.indexes.hasOwnProperty(key2)) {
      collection2.indexes[key2] = new BPlusTree;
    }
  } : undefined;
  const rebuild = key2 !== "*" ? async () => {
    if (!collection2.indexes.hasOwnProperty(key2)) {
      collection2.indexes[key2] = new BPlusTree;
      if (collection2.list.length > 0) {
        for await (const item of collection2.list.forward) {
          insert?.(item)?.(item[collection2.id]);
        }
      }
    }
  } : null;
  if (ensure)
    collection2.ensures.push(ensure);
  if (rebuild)
    collection2.rebuilds.push(rebuild);
  if (insert)
    collection2.inserts.push(insert);
  if (update)
    collection2.updates.push(update);
  if (remove)
    collection2.removes.push(remove);
}

// src/collection/build_indexes.ts
function build_indexes(collection2, indexList2) {
  for (const key2 in indexList2) {
    create_index(collection2, key2, indexList2[key2]);
  }
}

// src/collection/is_valid_ttl.ts
function is_valid_ttl(collection2, item) {
  if (item) {
    if (item[ttl_key]) {
      const now = Date.now();
      return now - item[ttl_key] <= collection2.ttl;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

// src/collection/return_list_if_valid.ts
async function return_list_if_valid(collection2, items) {
  let invalidate = false;
  const result = items.filter((i) => {
    if (is_valid_ttl(collection2, i)) {
      return true;
    } else {
      invalidate = true;
      return false;
    }
  });
  if (invalidate) {
    if (collection2.ttl && collection2.list.length > 0) {
      await ensure_ttl(collection2);
    }
  }
  return result;
}

// src/collection/get_indexed_value.ts
async function get_indexed_value(collection2, key2, value) {
  const result = [];
  if (collection2.indexes[key2]) {
    const keys = collection2.indexes[key2].find(value);
    for (const key3 of keys) {
      const res2 = await collection2.list.get(key3);
      result.push(res2);
    }
  }
  return return_list_if_valid(collection2, result);
}

// src/collection/return_one_if_valid.ts
async function return_one_if_valid(collection2, result) {
  let invalidate = false;
  if (result && !is_valid_ttl(collection2, result)) {
    invalidate = true;
  }
  if (invalidate) {
    if (collection2.ttl && collection2.list.length > 0) {
      await ensure_ttl(collection2);
    }
  }
  return invalidate ? undefined : result;
}

// src/collection/restore_index.ts
import * as _ from "lodash-es";

// src/collection/restore_index_def.ts
function restore_index_def(collection, input) {
  const { key, auto, unique, sparse, required, ignoreCase } = input;
  return {
    key,
    auto,
    unique,
    sparse,
    required,
    ignoreCase,
    process: ignoreCase ? undefined : input.process ? eval(input.process) : undefined,
    gen: input.gen ? Collection.genCache[input.gen] ? Collection.genCache[input.gen] : eval(input.gen) : undefined
  };
}

// src/collection/restore_index.ts
function restore_index(collection2, input2) {
  return _.map(input2, (index) => {
    return restore_index_def(collection2, index);
  }).reduce((res2, cur) => {
    res2[cur.key] = cur;
    return res2;
  }, {});
}

// src/utils/btree-serialization.ts
import {
  serializeTree,
  deserializeTree,
  createTreeFrom
} from "b-pl-tree";
function serializeBPlusTree(tree) {
  return serializeTree(tree);
}
function deserializeBPlusTree(data) {
  return createTreeFrom(data);
}
function cloneBPlusTree(source) {
  const serialized = serializeTree(source);
  return createTreeFrom(serialized);
}

// src/collection/deserialize_indexes.ts
function deserialize_indexes(indexes) {
  return Object.keys(indexes).reduce((res2, cur) => {
    res2[cur] = deserializeBPlusTree(indexes[cur]);
    return res2;
  }, {});
}

// src/collection/serialize_indexes.ts
function serialize_indexes(indexes) {
  return Object.keys(indexes).reduce((res2, cur) => {
    res2[cur] = serializeBPlusTree(indexes[cur]);
    return res2;
  }, {});
}

// src/collection/store_index.ts
import * as _2 from "lodash-es";

// src/collection/store_index_def.ts
function store_index_def(collection2, input2) {
  const { key: key2, auto: auto2, unique: unique2, sparse: sparse2, required: required2, ignoreCase: ignoreCase2 } = input2;
  return {
    key: key2,
    auto: auto2,
    unique: unique2,
    sparse: sparse2,
    required: required2,
    ignoreCase: ignoreCase2,
    process: ignoreCase2 ? undefined : input2.process ? input2.process.toString() : undefined,
    gen: input2.gen ? Collection.genCache[input2.gen.name] ? input2.gen.name : input2.gen.toString() : undefined
  };
}

// src/collection/store_index.ts
function store_index(collection2, input2) {
  return _2.map(input2, (index) => {
    return store_index_def(collection2, index);
  }).reduce((res2, cur) => {
    res2[cur.key] = cur;
    return res2;
  }, {});
}

// src/collection/copy_collection.ts
async function copy_collection(model, source, dest) {
  const collection2 = dest ?? Collection.create({
    root: source.root,
    name: model,
    adapter: source.storage.clone(),
    list: source.list.construct()
  });
  collection2.indexDefs = source.indexDefs;
  collection2.id = source.id;
  collection2.ttl = source.ttl;
  collection2.inserts = [];
  collection2.removes = [];
  collection2.updates = [];
  collection2.ensures = [];
  collection2.indexes = {};
  build_indexes(collection2, collection2.indexDefs);
  await ensure_indexes(collection2);
  for await (const item of source.list.forward) {
    await collection2.push(item);
  }
  await collection2.persist();
  return collection2;
}

// src/collection/do_rotate_log.ts
async function do_rotate_log(source) {
  await copy_collection(`${source.name}.${new Date().toJSON()}`, source);
  await source.reset();
  await source.persist();
}

// src/collection/get_first_indexed_value.ts
async function get_first_indexed_value(collection2, key2, value) {
  if (collection2.indexes[key2]) {
    const id2 = collection2.indexes[key2].findFirst(value);
    const result = id2 != null ? await collection2.list.get(id2) : undefined;
    return return_one_if_valid(collection2, result);
  }
}

// src/collection/get_last_indexed_value.ts
async function get_last_indexed_value(collection2, key2, value) {
  if (collection2.indexes[key2]) {
    const id2 = collection2.indexes[key2].findLast(value);
    const result = id2 != null ? await collection2.list.get(id2) : undefined;
    return return_one_if_valid(collection2, result);
  }
}

// src/collection/rebuild_indexes.ts
async function rebuild_indexes(collection2) {
  for (const reduild of collection2.rebuilds) {
    await reduild();
  }
}

// src/storage/List.ts
import { get as get4, set as set2, unset, cloneDeep } from "lodash-es";

// src/utils/entity_create.ts
import { diff } from "jsondiffpatch";

// src/utils/version_create.ts
function version_create(version, delta) {
  return {
    version,
    delta,
    date: Date.now()
  };
}

// src/utils/entity_create.ts
function entity_create(id2, item, schema) {
  return {
    id: id2,
    version: 0,
    next_version: 1,
    data: item,
    created: Date.now(),
    updated: undefined,
    deleted: undefined,
    schema,
    history: [version_create(0, diff({}, item))]
  };
}

// src/utils/entity_update.ts
import { diff as diff2 } from "jsondiffpatch";
function entity_update(record, item) {
  const delta = diff2(record.data, item);
  const v = version_create(record.next_version, delta);
  record.history.push(v);
  return {
    ...record,
    data: item,
    updated: Date.now(),
    next_version: record.next_version + 1
  };
}

// src/utils/entity_delete.ts
import { diff as diff3 } from "jsondiffpatch";
function entity_delete(record) {
  const delta = diff3({}, record.data);
  const v = version_create(record.next_version, delta);
  record.history.push(v);
  return {
    ...record,
    data: {},
    deleted: Date.now(),
    next_version: record.next_version + 1
  };
}

// src/utils/is_stored_record.ts
function is_stored_record(item) {
  if (!item || typeof item !== "object")
    return false;
  return Object.prototype.hasOwnProperty.call(item, "version") && typeof item.version === "number" && Object.prototype.hasOwnProperty.call(item, "next_version") && typeof item.next_version === "number" && Object.prototype.hasOwnProperty.call(item, "created") && typeof item.created === "number" && Object.prototype.hasOwnProperty.call(item, "history") && Array.isArray(item.history);
}

// src/storage/List.ts
class List {
  get name() {
    return "List";
  }
  singlefile = true;
  hash = {};
  _counter = 0;
  _count = 0;
  collection;
  exists = Promise.resolve(true);
  init(collection2) {
    this.collection = collection2;
    return this;
  }
  async clone() {
    const list2 = new List;
    list2.load(this.persist());
    return list2;
  }
  async get(key2) {
    const item = get4(this.hash, String(key2));
    let result;
    if (is_stored_record(item)) {
      result = cloneDeep(item.data);
      if (!this.collection.audit) {
        set2(this.hash, String(key2), result);
      }
    } else {
      result = cloneDeep(item);
    }
    return result;
  }
  get counter() {
    return this._counter;
  }
  get length() {
    return Object.keys(this.hash).length;
  }
  set length(len) {
    if (len === 0) {
      this.reset();
    }
  }
  async set(key2, item) {
    let valiadtor = this.collection.validator(item);
    if (valiadtor.success) {
      let result;
      if (this.collection.audit) {
        result = entity_create(item[this.collection.id], cloneDeep(item), this.collection.validation);
      } else {
        result = cloneDeep(item);
      }
      const keyStr = String(key2);
      const exists = Object.prototype.hasOwnProperty.call(this.hash, keyStr);
      set2(this.hash, keyStr, result);
      if (!exists) {
        this._counter++;
        this._count++;
      }
      return is_stored_record(item) ? item.data : item;
    }
    throw new Error("Validation error");
  }
  async update(key2, item) {
    let valiadtor = this.collection.validator(item);
    if (valiadtor.success) {
      let result = item;
      const record = get4(this.hash, String(key2));
      if (this.collection.audit) {
        let res2;
        if (!is_stored_record(record)) {
          res2 = entity_create(item[this.collection.id], item, this.collection.validation);
        } else {
          res2 = entity_update(record, cloneDeep(item));
        }
        set2(this.hash, String(key2), res2);
        result = res2.data;
      } else {
        set2(this.hash, String(key2), cloneDeep(result));
      }
      return result;
    }
    throw new Error("Validation error");
  }
  async delete(i) {
    const item = get4(this.hash, i?.toString() ?? "undefined");
    let result;
    if (is_stored_record(item)) {
      entity_delete(item);
      result = cloneDeep(item.data);
      this._count--;
    } else {
      unset(this.hash, i?.toString() ?? "undefined");
      this._count--;
      result = cloneDeep(item);
    }
    return result;
  }
  async reset() {
    this._count = 0;
    this._counter = 0;
    this.hash = {};
  }
  get keys() {
    return Object.keys(this.hash);
  }
  load(obj) {
    this.hash = obj.hash;
    this._count = obj._count;
    this._counter = obj._counter;
    return this;
  }
  construct() {
    return new List;
  }
  persist() {
    return {
      counter: this._counter,
      tree: {},
      _count: this._count,
      _counter: this._counter,
      hash: this.hash
    };
  }
  get forward() {
    return {
      [Symbol.asyncIterator]: () => this.toArray()
    };
  }
  get backward() {
    return {
      [Symbol.asyncIterator]: () => this.toArrayReverse()
    };
  }
  async* toArray() {
    for (const key2 of this.keys) {
      yield get4(this.hash, key2);
    }
  }
  async* toArrayReverse() {
    for (const key2 of this.keys.reverse()) {
      yield get4(this.hash, key2);
    }
  }
}

// src/AdapterMemory.ts
class AdapterMemory {
  get name() {
    return "AdapterMemory";
  }
  collection;
  clone() {
    return new AdapterMemory;
  }
  init(collection2) {
    this.collection = collection2;
    return this;
  }
  restore(name2) {
    return Promise.resolve({});
  }
  store(name2) {
    return Promise.resolve();
  }
}

// src/collection/serialize_collection_config.ts
function serialize_collection_config(collection2) {
  const res2 = {};
  res2.audit = collection2.audit ? true : undefined;
  res2.root = collection2.root;
  res2.rotate = collection2.rotate ?? undefined;
  res2.ttl = collection2.ttl ? collection2.ttl : undefined;
  res2.name = collection2.name;
  res2.adapter = collection2.storage.name;
  res2.list = collection2.list.name;
  res2.id = collection2.id || "id";
  res2.auto = collection2.auto ?? undefined;
  res2.indexList = Object.keys(collection2.indexDefs).map((name2) => {
    const res3 = collection2.indexDefs[name2];
    return serializeIndex(res3);
  });
  return res2;
}

// src/collection.ts
var ttl_key = "__ttltime";

class Collection {
  get config() {
    return serialize_collection_config(this);
  }
  static genCache = {
    autoIncIdGen,
    autoTimestamp
  };
  root;
  cronJob;
  async createIndex(name2, config2) {
    create_index(this, name2, config2);
    await ensure_indexes(this);
  }
  listIndexes(name2) {
    if (!name2) {
      return Object.keys(this.indexes).map((name3) => ({
        name: name3,
        key: { name: this.indexes[name3] }
      }));
    } else {
      if (this.indexes[name2]) {
        return [{ name: name2, keys: { name: this.indexes[name2] } }];
      } else {
        return [];
      }
    }
  }
  dropIndex(name2) {
    delete this.indexes[name2];
  }
  storage;
  ttl;
  rotate;
  name;
  id;
  auto;
  audit;
  validation = ItemSchema;
  validator(item) {
    if (this.validation) {
      return this.validation.safeParse(item);
    } else {
      return { success: true, data: item };
    }
  }
  indexes;
  list;
  inserts;
  updates;
  removes;
  ensures;
  rebuilds;
  indexDefs;
  constructor() {}
  static create(config) {
    const collection = new Collection;
    const {
      ttl,
      rotate,
      name,
      id = {
        name: "id",
        auto: true,
        gen: "autoIncIdGen"
      },
      auto = true,
      indexList,
      list = new List,
      adapter = new AdapterMemory,
      validation,
      audit,
      root
    } = config ?? {};
    collection.audit = !!audit;
    if (validation) {
      collection.validation = validation;
    }
    collection.root = root ?? "./data/";
    let { idGen = "autoIncIdGen" } = config ?? {};
    if (typeof idGen == "function") {
      idGen = idGen.toString();
    }
    if (rotate) {
      collection.cronJob = new CronJob(rotate, () => {
        do_rotate_log(collection);
      });
      collection.cronJob.start();
    }
    let Id = typeof id == "string" ? { name: id } : id;
    if (typeof id == "string") {
      Id = {
        name: id,
        auto: auto != null ? auto : true,
        gen: idGen
      };
    }
    if (!Id.name) {
      Id.name = "id";
    }
    if (Id.gen == null) {
      Id.gen = idGen;
    }
    if (!name) {
      throw new Error('must Have Model Name as "name" prop in config');
    }
    collection.ttl = (typeof ttl == "string" ? parse(ttl) : ttl) || undefined;
    collection.rotate = rotate;
    collection.name = name;
    collection.storage = adapter.init(collection);
    collection.id = Id.name;
    collection.auto = Id.auto;
    collection.indexes = {};
    collection.list = list;
    collection.indexDefs = {};
    collection.inserts = [];
    collection.removes = [];
    collection.updates = [];
    collection.ensures = [];
    collection.rebuilds = [];
    const defIndex = [
      {
        key: collection.id,
        auto: collection.auto,
        gen: typeof Id.gen == "function" ? Id.gen : Id.gen && Collection.genCache[Id.gen] ? Collection.genCache[Id.gen] : Id.gen ? eval(Id.gen) : undefined,
        unique: true,
        sparse: false,
        required: true
      }
    ];
    if (collection.ttl) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: Collection.genCache["autoTimestamp"],
        unique: false,
        sparse: false,
        required: true
      });
    }
    if (collection.rotate) {
      defIndex.push({
        key: ttl_key,
        auto: true,
        gen: Collection.genCache["autoTimestamp"],
        unique: false,
        sparse: false,
        required: true
      });
    }
    build_indexes(collection, defIndex.concat(indexList || []).reduce((prev, curr) => {
      if (curr.key == "*") {
        prev[curr.key] = {
          key: "*",
          auto: false,
          unique: false,
          gen: undefined,
          sparse: false,
          required: false,
          ignoreCase: true
        };
      } else {
        prev[curr.key] = {
          key: curr.key,
          auto: curr.auto || false,
          unique: curr.unique || false,
          gen: curr.gen || (curr.auto ? Collection.genCache["autoIncIdGen"] : undefined),
          sparse: curr.sparse || false,
          required: curr.required || false,
          ignoreCase: curr.ignoreCase,
          process: curr.process
        };
      }
      return prev;
    }, {}));
    collection.list.init(collection);
    ensure_indexes(collection);
    return collection;
  }
  static async fromList(array, id2, root2) {
    const list2 = Collection.create({
      root: root2,
      name: "default",
      indexList: [{ key: "*" }, { key: id2, unique: true, required: true }],
      id: { name: "$order", auto: true },
      list: new List,
      adapter: new AdapterMemory
    });
    await Promise.all(array.map((item) => list2.create(item)));
    return list2;
  }
  async reset() {
    await this.list.reset();
    this.indexes = {};
    ensure_indexes(this);
  }
  async load(name2) {
    try {
      const stored = await this.storage.restore(name2);
      if (stored) {
        const { indexes, list: list2, indexDefs, id: id2, ttl: ttl2 } = stored;
        this.list.load(list2);
        this.indexDefs = restore_index(this, indexDefs);
        this.id = id2;
        this.ttl = ttl2;
        this.inserts = [];
        this.removes = [];
        this.updates = [];
        this.ensures = [];
        this.indexes = {};
        build_indexes(this, this.indexDefs);
        this.indexes = deserialize_indexes(indexes);
        await rebuild_indexes(this);
      }
    } catch (e) {}
    await ensure_ttl(this);
  }
  store() {
    return {
      list: this.list.persist(),
      indexes: serialize_indexes(this.indexes),
      indexDefs: store_index(this, this.indexDefs),
      id: this.id,
      ttl: this.ttl,
      rotate: this.rotate ? parseInt(this.rotate) : undefined
    };
  }
  async persist(name2) {
    await this.storage.store(name2);
  }
  async push(item) {
    const insert_indexed_values = prepare_index_insert(this, item);
    const id2 = item[this.id];
    const res2 = await this.list.set(id2, item);
    insert_indexed_values(id2);
    return return_one_if_valid(this, res2);
  }
  async create(item) {
    const res2 = { ...item };
    const value = await this.push(res2);
    return value;
  }
  async save(res2) {
    const id2 = res2[this.id];
    const item = await this.findById(id2);
    await update_index(this, item, res2, id2);
    await this.list.update(id2, res2);
    return return_one_if_valid(this, res2);
  }
  async first() {
    return (await first(this, () => true).next()).value;
  }
  async last() {
    return (await last(this, () => true).next()).value;
  }
  lowest(key2) {
    return this.findFirstBy(key2, this.indexes[key2].min);
  }
  greatest(key2) {
    return this.findLastBy(key2, this.indexes[key2].max);
  }
  oldest() {
    if (this.ttl) {
      return this.lowest(ttl_key);
    } else
      return this.first();
  }
  latest() {
    if (this.ttl) {
      return this.greatest(ttl_key);
    } else
      return this.last();
  }
  async findById(id2) {
    const indexDef = this.indexDefs[this.id];
    if (indexDef?.process) {
      id2 = indexDef.process(id2);
    }
    const index = this.indexes[this.id];
    if (!index) {
      throw new Error(`Index for ${this.id} not found`);
    }
    const result = await this.list.get(index.findFirst(id2));
    return return_one_if_valid(this, result);
  }
  async findBy(key2, id2) {
    if (this.indexDefs.hasOwnProperty(key2)) {
      const indexDef = this.indexDefs[key2];
      if (indexDef?.process) {
        id2 = indexDef.process(id2);
      }
      const result = [];
      if (this.indexDefs.hasOwnProperty(key2)) {
        result.push(...await get_indexed_value(this, key2, id2));
      }
      return return_list_if_valid(this, result);
    } else {
      throw new Error(`Index for ${key2} not found`);
    }
  }
  async findFirstBy(key2, id2) {
    if (this.indexDefs.hasOwnProperty(key2)) {
      const indexDef = this.indexDefs[key2];
      if (indexDef?.process) {
        id2 = indexDef.process(id2);
      }
      if (this.indexDefs.hasOwnProperty(key2)) {
        const result = await get_first_indexed_value(this, key2, id2);
        return return_one_if_valid(this, result);
      }
    }
    throw new Error(`Index for ${key2} not found`);
  }
  async findLastBy(key2, id2) {
    if (this.indexDefs.hasOwnProperty(key2)) {
      const indexDef = this.indexDefs[key2];
      if (indexDef?.process) {
        id2 = indexDef.process(id2);
      }
      if (this.indexDefs.hasOwnProperty(key2)) {
        const result = await get_last_indexed_value(this, key2, id2);
        return return_one_if_valid(this, result);
      }
    }
    throw new Error(`Index for ${key2} not found`);
  }
  async find(condition) {
    const result = [];
    for await (const item of all(this, condition)) {
      result.push(item);
    }
    return return_list_if_valid(this, result);
  }
  async findFirst(condition) {
    const result = await (await first(this, condition).next()).value;
    return return_one_if_valid(this, result);
  }
  async findLast(condition) {
    const result = await (await last(this, condition).next()).value;
    return return_one_if_valid(this, result);
  }
  async update(condition, update, merge2 = true) {
    const result = [];
    for await (const item of all(this, condition)) {
      const res2 = merge2 ? _3.merge({}, item, update) : _3.assign({}, item, update);
      await update_index(this, item, res2, item[this.id]);
      await this.list.update(item[this.id], res2);
      result.push(res2);
    }
    return return_list_if_valid(this, result);
  }
  async updateFirst(condition, update, merge2 = true) {
    const item = await (await first(this, condition).next()).value;
    const res2 = merge2 ? _3.merge({}, item, update) : _3.assign({}, item, update);
    await update_index(this, item, res2, item[this.id]);
    await this.list.update(item[this.id], res2);
    return return_one_if_valid(this, res2);
  }
  async updateLast(condition, update, merge2 = true) {
    const item = await (await last(this, condition).next()).value;
    const res2 = merge2 ? _3.merge({}, item, update) : _3.assign({}, item, update);
    await update_index(this, item, res2, item[this.id]);
    await this.list.update(item[this.id], res2);
    return return_one_if_valid(this, res2);
  }
  async updateWithId(id2, update, merge2 = true) {
    const item = await this.findById(id2);
    const res2 = merge2 ? _3.merge({}, item, update) : _3.assign({}, item, update);
    await update_index(this, item, res2, id2);
    await this.list.update(id2, res2);
    return return_one_if_valid(this, res2);
  }
  async removeWithId(id2) {
    const indexDef = this.indexDefs[this.id];
    if (indexDef?.process) {
      id2 = indexDef.process(id2);
    }
    const index = this.indexes[this.id];
    if (!index) {
      throw new Error(`Index for ${this.id} not found`);
    }
    const i = index.findFirst(id2);
    const cur = await this.list.get(i);
    if (i !== undefined && cur) {
      remove_index(this, cur);
      const result = await this.list.delete(id2);
      return return_one_if_valid(this, result);
    }
  }
  async remove(condition) {
    const result = [];
    for await (const cur of all(this, condition)) {
      remove_index(this, cur);
      const res2 = await this.list.delete(cur[this.id]);
      result.push(res2);
    }
    return return_list_if_valid(this, result);
  }
  async removeFirst(condition) {
    const item = await (await first(this, condition).next()).value;
    remove_index(this, item);
    await this.list.delete(item[this.id]);
    return return_one_if_valid(this, item);
  }
  async removeLast(condition) {
    const item = await (await last(this, condition).next()).value;
    remove_index(this, item);
    await this.list.delete(item[this.id]);
    return return_one_if_valid(this, item);
  }
}
function serializeIndex(res2) {
  return {
    key: res2.key,
    auto: res2.auto ? true : undefined,
    unique: res2.unique ? true : undefined,
    sparse: res2.sparse ? true : undefined,
    ignoreCase: res2.ignoreCase ? true : undefined,
    required: res2.required ? true : undefined,
    gen: res2.gen?.name ?? undefined,
    process: res2.process?.toString() ?? undefined
  };
}
function deserializeIndex(res) {
  return {
    key: res.key,
    auto: res.auto ? true : undefined,
    unique: res.unique ? true : undefined,
    sparse: res.sparse ? true : undefined,
    ignoreCase: res.ignoreCase ? true : undefined,
    required: res.required ? true : undefined,
    gen: res.gen ? Collection.genCache[res.gen] : undefined,
    process: res.process ? eval(res.process) : undefined
  };
}

// src/storage/FileStorage.ts
import { BPlusTree as BPlusTree3 } from "b-pl-tree";
import fs2 from "fs-extra";
import pathlib from "path";
import { cloneDeep as cloneDeep2 } from "lodash-es";
import { fromZodError } from "zod-validation-error";
class FileStorage {
  get name() {
    return "FileStorage";
  }
  singlefile = false;
  tree = new BPlusTree3(32, true);
  get folder() {
    return pathlib.join(this.collection.root, this.collection.name);
  }
  keyField;
  constructor(keyField) {
    this.keyField = keyField;
  }
  exists;
  collection;
  construct() {
    return new FileStorage;
  }
  init(collection2) {
    this.collection = collection2;
    if (this.keyField && !this.collection.indexDefs[this.keyField].unique) {
      throw new Error(`key field ${this.keyField} is not unique`);
    }
    this.exists = fs2.ensureDir(this.folder).then((_4) => true).catch((_4) => false);
    return this;
  }
  async clone() {
    if (await this.exists) {
      const res2 = new FileStorage;
      res2.tree = cloneBPlusTree(this.tree);
      return res2;
    }
    throw new Error("folder not found");
  }
  persist() {
    return {
      keyField: this.keyField,
      counter: this._counter,
      tree: serializeBPlusTree(this.tree)
    };
  }
  load(obj) {
    this._counter = obj.counter;
    this.keyField = !obj.keyField ? this.keyField : this.keyField ? this.keyField : obj.keyField;
    this.tree = deserializeBPlusTree(obj.tree);
    return this;
  }
  get forward() {
    return {
      [Symbol.asyncIterator]: () => this.toArray()
    };
  }
  get backward() {
    return {
      [Symbol.asyncIterator]: () => this.toArrayReverse()
    };
  }
  async* toArray() {
    const res2 = await this.exists;
    if (res2) {
      const it = this.tree.each()(this.tree);
      let cursor = it.next();
      while (!cursor.done && cursor.value) {
        yield await fs2.readJSON(this.get_path(cursor.value.value));
        cursor = it.next();
      }
    } else
      throw new Error("folder not found");
  }
  async* toArrayReverse() {
    if (await this.exists) {
      const it = this.tree.each(false)(this.tree);
      let cursor = it.next();
      while (!cursor.done && cursor.value) {
        yield await fs2.readJSON(this.get_path(cursor.value.value));
        cursor = it.next();
      }
    } else
      throw new Error("folder not found");
  }
  key_filename(key2) {
    return `${key2?.toString() ?? "undefined"}.json`;
  }
  set_path(key2) {
    return pathlib.join(this.folder, this.key_filename(key2));
  }
  get_path(value) {
    return pathlib.join(this.folder, value);
  }
  async reset() {
    if (await this.exists) {
      await fs2.remove(this.folder);
      this.tree.reset();
      this.exists = fs2.ensureDir(this.folder).then((_4) => true).catch((_4) => false);
    } else
      throw new Error("folder not found");
  }
  async get(key2) {
    if (await this.exists) {
      const value = this.tree.findFirst(key2);
      if (value) {
        const location = this.get_path(value);
        const result = await fs2.readJSON(location);
        if (is_stored_record(result)) {
          if (!this.collection.audit) {
            await fs2.writeJSON(location, result);
          }
          return result.data;
        } else {
          return result;
        }
      }
    }
    throw new Error("folder not found");
  }
  async set(key2, item) {
    if (await this.exists) {
      let valiadtor = this.collection.validator(item);
      if (valiadtor.success) {
        this._counter++;
        const uid = this.keyField ? item[this.keyField] ? item[this.keyField] : key2 : key2;
        let result;
        if (this.collection.audit) {
          result = entity_create(item[this.collection.id], cloneDeep2(item), this.collection.validation);
        } else {
          result = cloneDeep2(item);
        }
        await fs2.writeJSON(this.set_path(uid), result);
        this.tree.insert(key2, this.key_filename(uid));
        return this.collection.audit ? result.data : result;
      } else {
        console.log(fromZodError(valiadtor.errors));
        throw new Error("Validation error");
      }
    }
    throw new Error("folder not found");
  }
  async update(key2, item) {
    if (await this.exists) {
      let valiadtor = this.collection.validator(item);
      if (valiadtor.success) {
        const location = this.get_path(this.tree.findFirst(key2));
        let result = item;
        const record = await fs2.readJSON(location);
        if (this.collection.audit) {
          let res2;
          if (!is_stored_record(record)) {
            res2 = entity_create(item[this.collection.id], cloneDeep2(item), this.collection.validation);
          } else {
            res2 = entity_update(record, cloneDeep2(item));
          }
          result = res2.data;
          await fs2.writeJSON(location, res2);
        } else {
          await fs2.writeJSON(location, result);
        }
        return result;
      } else {
        console.log(fromZodError(valiadtor.errors));
        throw new Error("Validation error");
      }
    }
    throw new Error("folder not found");
  }
  async delete(key2) {
    if (await this.exists) {
      const value = this.tree.findFirst(key2);
      if (value) {
        const location = this.get_path(value);
        const item = await fs2.readJSON(location);
        let result;
        if (is_stored_record(item)) {
          result = item.data;
          const res2 = entity_delete(item);
          await fs2.writeJSON(location, res2);
        } else {
          result = item;
          await fs2.unlink(location);
        }
        this.tree.remove(key2);
        return result;
      }
    }
    throw new Error("folder not found");
  }
  _counter = 0;
  get counter() {
    return this._counter;
  }
  get length() {
    return this.tree.size;
  }
}

// src/CSDatabase.ts
import fs3 from "fs";
import path from "path";
import fse from "fs-extra";

// src/collection/deserialize_collection_config.ts
function deserialize_collection_config(config2) {
  const res2 = {};
  res2.name = config2.name;
  res2.root = config2.root;
  res2.rotate = config2.rotate;
  res2.ttl = config2.ttl;
  res2.audit = config2?.audit ?? false;
  res2.id = config2.id || "id";
  res2.auto = config2.auto;
  res2.indexList = config2.indexList.map((index) => deserializeIndex(index));
  res2.adapter = config2.adapter === "AdapterMemory" ? new AdapterMemory : new AdapterFile;
  res2.list = config2.list === "List" ? new List : new FileStorage;
  return res2;
}

// src/CSDatabase.ts
class CSDatabase {
  root;
  name;
  inTransaction = false;
  collections;
  constructor(root2, name2) {
    this.root = root2;
    this.name = name2 || "default";
    this.collections = new Map;
  }
  async writeSchema() {
    const result = {};
    this.collections.forEach((collection2, name2) => {
      result[name2] = serialize_collection_config(collection2);
    });
    await fse.ensureDir(this.root);
    fs3.writeFileSync(path.join(this.root, `${this.name}.json`), JSON.stringify(result, null, 2));
  }
  async connect() {
    await this.load();
  }
  async load() {
    const exists = fs3.existsSync(path.join(this.root, `${this.name}.json`));
    if (!exists) {
      fse.ensureDirSync(this.root);
    } else {
      const result = fse.readJSONSync(path.join(this.root, `${this.name}.json`));
      this.collections.clear();
      for (const name2 in result) {
        const config2 = result[name2];
        const collection2 = Collection.create(deserialize_collection_config(config2));
        await collection2.load();
        this.registerCollection(collection2);
      }
    }
  }
  async close() {}
  collectionList = new Map;
  registerCollection(collection2) {
    if (!this.collections.has(collection2.name)) {
      this.collections.set(collection2.name, collection2);
      return;
    }
    throw new Error(`collection ${collection2.name} already exists`);
  }
  async createCollection(name2) {
    const [, collectionType = "List"] = name2.split(":");
    const collection2 = Collection.create({
      name: name2,
      list: collectionType === "List" ? new List : new FileStorage,
      adapter: new AdapterFile,
      root: path.join(this.root, this.name)
    });
    this.registerCollection(collection2);
    await this.writeSchema();
    return collection2;
  }
  listCollections() {
    const result = [];
    this.collections.forEach((collection2) => {
      result.push(collection2);
    });
    return result;
  }
  async dropCollection(name2) {
    let result = false;
    if (this.collections.has(name2)) {
      const collection2 = this.collections.get(name2);
      await collection2.reset();
      result = this.collections.delete(name2);
      await this.writeSchema();
    }
    return result;
  }
  collection(name2) {
    if (this.collections.has(name2)) {
      return this.collections.get(name2);
    }
    throw new Error(`collection ${name2} not found`);
  }
  async createIndex(collection2, name2, def) {
    if (this.collections.has(collection2)) {
      const col = this.collections.get(collection2);
      if (col.listIndexes(name2)) {
        col.dropIndex(name2);
        await col.createIndex(name2, def);
      }
      await this.writeSchema();
      return;
    }
    throw new Error(`collection ${collection2} not found`);
  }
  async dropIndex(collection2, name2) {
    if (this.collections.has(collection2)) {
      this.collections.get(collection2)?.dropIndex(name2);
      await this.writeSchema();
      return;
    }
    throw new Error(`collection ${collection2} not found`);
  }
  async persist() {
    const res2 = [];
    this.collections.forEach((collection2) => {
      res2.push(collection2.persist());
    });
    return Promise.all(res2);
  }
  async startSession() {
    if (!this.inTransaction) {
      await this.persist();
    }
    return this;
  }
  async endSession() {
    this.inTransaction = false;
  }
  async startTransaction(options) {
    this.inTransaction = true;
  }
  async abortTransaction() {
    this.inTransaction = false;
  }
  async commitTransaction() {
    await this.persist();
    this.inTransaction = false;
  }
  async first(collection2) {
    return this.collections.get(collection2).first();
  }
  async last(collection2) {
    return this.collections.get(collection2).last();
  }
  async lowest(collection2, key2) {
    return this.collections.get(collection2).lowest(key2);
  }
  async greatest(collection2, key2) {
    return this.collections.get(collection2).greatest(key2);
  }
  async oldest(collection2) {
    return this.collections.get(collection2).oldest();
  }
  async latest(collection2) {
    return this.collections.get(collection2).latest();
  }
  async findById(collection2, id2) {
    return this.collections.get(collection2).findById(id2);
  }
  async findBy(collection2, key2, id2) {
    return this.collections.get(collection2).findBy(key2, id2);
  }
  async findFirstBy(collection2, key2, id2) {
    return this.collections.get(collection2).findFirstBy(key2, id2);
  }
  async findLastBy(collection2, key2, id2) {
    return this.collections.get(collection2).findLastBy(key2, id2);
  }
}
export {
  copy_collection,
  List,
  FileStorage,
  Collection,
  CSDatabase,
  AdapterMemory,
  AdapterFile
};

//# debugId=352BD352F1F6430564756E2164756E21
