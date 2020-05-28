"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.List = exports.autoTimestamp = exports.autoIncIdGen = void 0;
const timeparse_1 = __importDefault(require("timeparse"));
function autoIncIdGen(item, model, list) {
    return list.counter;
}
exports.autoIncIdGen = autoIncIdGen;
;
function autoTimestamp(item, model, list) {
    return Date.now();
}
exports.autoTimestamp = autoTimestamp;
;
class List {
    constructor(stored) {
        this.hash = {};
        this._counter = 0;
        this._count = 0;
        if (stored) {
            this.load(stored);
        }
    }
    get(key) {
        return this.hash[key];
    }
    get counter() {
        return this._counter;
    }
    get length() {
        return this._count;
    }
    set length(len) {
        if (len === 0) {
            this.reset();
        }
    }
    push(...items) {
        items.forEach((item) => {
            this.hash[this._counter++, this._count++] = item;
        });
        return this._count;
    }
    remove(i) {
        let result = this.hash[i];
        delete this.hash[i];
        this._count--;
        return result;
    }
    reset() {
        this._count = 0;
        this._counter = 0;
        this.hash = {};
    }
    [Symbol.iterator]() {
        let self = this;
        return (function* () { yield* self.keys; })();
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
    persist() {
        return {
            _count: this._count,
            _counter: this._counter,
            hash: this.hash,
        };
    }
}
exports.List = List;
class CollectionBase {
    constructor(config) {
        let { ttl, name, id = {
            name: 'id',
            auto: true,
            gen: 'autoIncIdGen',
        }, idGen = 'autoIncIdGen', auto = true, indexList, } = config;
        let Id = typeof id == "string" ? { name: id } : id;
        if ('string' == typeof id) {
            Id = {
                name: id,
                auto: (typeof auto != 'undefined') ? auto : true,
                gen: idGen || 'autoIncIdGen',
            };
        }
        else if (id instanceof Function) {
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
        this.ttl = (typeof ttl == 'string' ? timeparse_1.default(ttl) : ttl) || false;
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
        let defIndex = [{
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
        }, {}));
        this.ensureIndexes();
    }
    reset() {
        this.list.length = 0;
        this.indexes = {};
        this.ensureIndexes();
    }
    __restore() {
        throw new Error('not implemented');
    }
    __store(obj) {
        throw new Error('not implemented');
    }
    load() {
        let stored = this.__restore();
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
        this.ensureTTL();
    }
    ensureTTL() {
        if (this.ttl) {
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
    persist() {
        this.__store({
            list: this.list.persist(),
            indexes: this.indexes,
            indexDefs: this.indexDefs,
            id: this.id,
            ttl: this.ttl,
        });
    }
    restoreIndex() {
        for (let key in this.indexDefs) {
            let gen = this.indexDefs[key].gen;
            this.genCache[gen] = eval(gen);
        }
    }
    _buildIndex(indexList) {
        for (let key in indexList) {
            let { auto = false, unique = false, gen = 'autoIncIdGen', sparse = false, required = false, } = indexList[key];
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
                if (required && value == null) {
                    throw new Error(`value for index ${key} is required, but ${value} is met`);
                }
                if (unique && this.indexes.hasOwnProperty(key) && this.indexes[key].hasOwnProperty(value)) {
                    throw new Error(`unique index ${key} already contains value ${value}`);
                }
            };
            let ensureValue = (item) => {
                let value = item[key];
                if ((value == null) && auto) {
                    item[key] = value = this.genCache[gen](item, this.model, this.list);
                }
                return value;
            };
            let getValue = (item) => {
                return item[key];
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
                    if (valueNew !== undefined && valueNew !== null) {
                        validate(valueNew);
                        if (valueOld !== valueNew) {
                            delete this.indexes[key][valueOld];
                            this.indexes[key][valueNew] = i;
                        }
                    }
                });
                this.removes.push((item, i) => {
                    delete this.indexes[key][item[key]];
                });
            }
            else {
                this.inserts.push((item) => {
                    let value = ensureValue(item);
                    validate(value);
                    if (!(sparse && value == null)) {
                        if (!this.indexes[key].hasOwnProperty(value)) {
                            this.indexes[key][value] = [];
                        }
                        return (i) => this.indexes[key][value].push(i);
                    }
                });
                this.updates.push((ov, nv, i) => {
                    let valueOld = ensureValue(ov);
                    let valueNew = getValue(nv);
                    if (valueNew !== undefined && valueNew !== null) {
                        validate(valueNew);
                        if (valueOld !== valueNew) {
                            let items = this.indexes[key][valueOld];
                            items.splice(items.indexOf(i), 1);
                            items.push(i);
                        }
                    }
                });
                this.removes.push((item, i) => {
                    let items = this.indexes[key][item[key]];
                    items.splice(items.indexOf(i), 1);
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
            result.forEach(f => f(i));
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
        let index = this.list.push(item) - 1;
        insert(index);
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
            }
            else {
                for (let m in condition) {
                    if (condition[m] == current[m]) {
                        mc++;
                    }
                    else {
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
    create(item) {
        let res = {};
        for (let m in item) {
            res[m] = item[m];
        }
        this.push(res);
        return res;
    }
    findById(id) {
        return this.list.get(this.indexes[this.id][id]);
    }
    findBy(key, id) {
        if (this.indexDefs.hasOwnProperty(key)) {
            if (this.indexDefs[key].unique) {
                return [this.list.get(this.indexes[key][id])];
            }
            else {
                if (this.indexes[key].hasOwnProperty(id)) {
                    return this.indexes[key][id].map((i) => this.list.get(i));
                }
            }
        }
    }
    find(condition) {
        const result = [];
        this._traverse(condition, (i, cur) => {
            result.push(cur);
            return true;
        });
        return result;
    }
    findOne(condition) {
        let result;
        this._traverse(condition, (i, cur) => {
            result = cur;
        });
        return result;
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
        for (let u in update) {
            result[u] = update[u];
        }
    }
    removeWithId(id) {
        let i = this.indexes[this.id][id];
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
exports.default = CollectionBase;
//# sourceMappingURL=collection.js.map