'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollectionWeb = exports.List = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // import fs from 'fs-extra';


exports.autoIncIdGen = autoIncIdGen;
exports.autoTimestamp = autoTimestamp;

var _timeparse = require('timeparse');

var _timeparse2 = _interopRequireDefault(_timeparse);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function autoIncIdGen(item, model, list) {
  return list.counter;
};

function autoTimestamp(item, model, list) {
  return Date.now();
};

var List = exports.List = function () {
  function List() {
    _classCallCheck(this, List);

    this.reset();
  }

  _createClass(List, [{
    key: 'get',
    value: function get(key) {
      return this.hash[key];
    }
  }, {
    key: 'push',
    value: function push() {
      var _this = this;

      for (var _len = arguments.length, items = Array(_len), _key = 0; _key < _len; _key++) {
        items[_key] = arguments[_key];
      }

      items.forEach(function (item) {
        _this.hash[(_this._counter++, _this._count++)] = item;
      });
      return this._count;
    }
  }, {
    key: 'remove',
    value: function remove(i) {
      var result = this.hash[i];
      delete this.hash[i];
      this._count--;
      return result;
    }
  }, {
    key: 'reset',
    value: function reset() {
      this._count = 0;
      this._counter = 0;
      this.hash = {};
    }
  }, {
    key: Symbol.iterator,
    value: function value() {
      var self = this;
      return regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.delegateYield(self.keys, 't0', 1);

              case 1:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      })();
    }
  }, {
    key: 'load',
    value: function load(obj) {
      this.hash = obj.hash;
      this._count = obj._count;
      this._counter = obj._counter;
    }
  }, {
    key: 'persist',
    value: function persist() {
      return {
        _count: this._count,
        _counter: this._counter,
        hash: this.hash
      };
    }
  }, {
    key: 'counter',
    get: function get() {
      return this._counter;
    }
  }, {
    key: 'length',
    get: function get() {
      return this._count;
    },
    set: function set(len) {
      if (len === 0) {
        this.reset();
      }
    }
  }, {
    key: 'keys',
    get: function get() {
      return Object.keys(this.hash);
    }
  }]);

  return List;
}();

var CollectionBase = function () {
  function CollectionBase(config) {
    _classCallCheck(this, CollectionBase);

    var ttl = config.ttl;
    var name = config.name;
    var _config$id = config.id;
    var id = _config$id === undefined ? {
      name: 'id',
      auto: true,
      gen: 'autoIncIdGen'
    } : _config$id;
    var _config$idGen = config.idGen;
    var idGen = _config$idGen === undefined ? 'autoIncIdGen' : _config$idGen;
    var _config$auto = config.auto;
    var auto = _config$auto === undefined ? true : _config$auto;
    var indexList = config.indexList;


    if ('string' == typeof id) {
      id = {
        name: id,
        auto: typeof auto != 'undefined' ? auto : true,
        gen: idGen || 'autoIncIdGen'
      };
    } else if (id instanceof Function) {
      id = id();
    }

    if ('undefined' == typeof id.name) {
      id.name = 'id';
    }

    if ('undefined' == typeof id.auto) {
      id.auto = typeof auto != 'undefined' ? auto : true;
    }

    if ('undefined' == typeof id.gen) {
      id.gen = idGen || 'autoIncIdGen';
    }

    if (!name) {
      throw new Error('must Have Model Name as "model" prop in config');
    }
    this.ttl = (typeof ttl == 'string' ? (0, _timeparse2.default)(ttl) : ttl) || false;
    this.model = name;
    this.id = id.name;
    this.auto = id.auto;
    this.indexes = {};
    this.list = new List();
    this.indexDefs = {};
    this.inserts = [];
    this.removes = [];
    this.updates = [];
    this.ensures = [];

    this.genCache = {
      autoIncIdGen: autoIncIdGen,
      autoTimestamp: autoTimestamp
    };

    var defIndex = [{
      key: this.id,
      auto: this.auto,
      gen: typeof id.gen == 'function' ? id.gen.toString() : id.gen,
      unique: true,
      sparse: false,
      required: true
    }];

    if (this.ttl) {
      defIndex.push({
        key: '__ttltime',
        auto: true,
        gen: 'autoTimestamp',
        unique: false,
        sparse: false,
        required: true
      });
    }

    this._buildIndex(defIndex.concat(indexList || []).reduce(function (prev, curr) {
      prev[curr.key] = {
        key: curr.key,
        auto: curr.auto || false,
        unique: curr.unique || false,
        gen: curr.gen || 'autoIncIdGen',
        sparse: curr.sparse || false,
        required: curr.required || false
      };
      return prev;
    }, {}));
    this.ensureIndexes();
  }

  _createClass(CollectionBase, [{
    key: 'reset',
    value: function reset() {
      this.list.length = 0;
      this.indexes = {};
      this.ensureIndexes();
    }
  }, {
    key: '__restore',
    value: function __restore() {
      throw new Error('not implemented');
    }
  }, {
    key: '__store',
    value: function __store(obj) {
      throw new Error('not implemented');
    }
  }, {
    key: 'load',
    value: function load() {
      var stored = this.__restore();
      if (stored) {
        var indexes = stored.indexes;
        var list = stored.list;
        var indexDefs = stored.indexDefs;
        var id = stored.id;
        var ttl = stored.ttl;

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
  }, {
    key: 'ensureTTL',
    value: function ensureTTL() {
      if (this.ttl) {
        // ensure that all object are actuated with time
        var now = Date.now();
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = this.list.keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var i = _step.value;

            var item = this.list.get(i);
            if (now - item.__ttltime >= this.ttl) {
              this.removeWithId(item[this.id]);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        this.persist();
      }
    }
  }, {
    key: 'persist',
    value: function persist() {
      this.__store({
        list: this.list.persist(),
        indexes: this.indexes,
        indexDefs: this.indexDefs,
        id: this.id,
        ttl: this.ttl
      });
    }
  }, {
    key: 'restoreIndex',
    value: function restoreIndex() {
      for (var key in this.indexDefs) {
        var gen = this.indexDefs[key].gen;
        this.genCache[gen] = eval(gen);
      }
    }
  }, {
    key: '_buildIndex',
    value: function _buildIndex(indexList) {
      var _this2 = this;

      var _loop = function _loop(key) {
        var _indexList$key = indexList[key];
        var _indexList$key$auto = _indexList$key.auto;
        var auto = _indexList$key$auto === undefined ? false : _indexList$key$auto;
        var _indexList$key$unique = _indexList$key.unique;
        var unique = _indexList$key$unique === undefined ? false : _indexList$key$unique;
        var _indexList$key$gen = _indexList$key.gen;
        var gen = _indexList$key$gen === undefined ? 'autoIncIdGen' : _indexList$key$gen;
        var _indexList$key$sparse = _indexList$key.sparse;
        var sparse = _indexList$key$sparse === undefined ? false : _indexList$key$sparse;
        var _indexList$key$requir = _indexList$key.required;
        var required = _indexList$key$requir === undefined ? false : _indexList$key$requir;


        if (typeof gen == 'function') {
          _this2.genCache[get.toString()] = gen;
          gen = gen.toString();
        }

        if (!key) {
          throw new Error('key is required field for index');
        }

        _this2.indexDefs[key] = {
          auto: auto,
          unique: unique,
          gen: gen,
          sparse: sparse,
          required: required
        };

        if (_this2.indexes.hasOwnProperty(key)) {
          throw new Error('index with key ' + key + ' already exists');
        }

        var validate = function validate(value) {
          if (required && (value === null || value === undefined)) {
            throw new Error('value for index ' + key + ' is required, but ' + value + ' is met');
          }

          if (unique && _this2.indexes.hasOwnProperty(key) && _this2.indexes[key].hasOwnProperty(value)) {
            throw new Error('unique index ' + key + ' already contains value ' + value);
          }
        };

        var ensureValue = function ensureValue(item) {
          var value = item[key];
          if ((value === null || value === undefined) && auto) {
            item[key] = value = _this2.genCache[gen](item, _this2.model, _this2.list);
          }
          return value;
        };

        var getValue = function getValue(item) {
          return item[key];
        };

        _this2.ensures.push(function () {
          if (!_this2.indexes.hasOwnProperty(key)) {
            _this2.indexes[key] = {};
          }
        });

        if (unique) {

          _this2.inserts.push(function (item) {
            var value = ensureValue(item);
            validate(value);
            if (!(sparse && (value === null || value === undefined))) {
              if (!_this2.indexes[key].hasOwnProperty(value)) {
                _this2.indexes[key][value] = {};
              }
              return function (i) {
                return _this2.indexes[key][value] = i;
              };
            }
          });

          _this2.updates.push(function (ov, nv, i) {
            var valueOld = ensureValue(ov);
            var valueNew = getValue(nv);
            if (valueNew !== undefined && valueNew !== null) {
              validate(valueNew);
              if (valueOld !== valueNew) {
                delete _this2.indexes[key][valueOld];
                _this2.indexes[key][valueNew] = i;
              }
            }
          });

          _this2.removes.push(function (item, i) {
            delete _this2.indexes[key][item[key]];
          });
        } else {

          _this2.inserts.push(function (item) {
            var value = ensureValue(item);
            validate(value);
            if (!(sparse && (value === null || value === undefined))) {
              if (!_this2.indexes[key].hasOwnProperty(value)) {
                _this2.indexes[key][value] = [];
              }
              return function (i) {
                return _this2.indexes[key][value].push(i);
              };
            }
          });

          _this2.updates.push(function (ov, nv, i) {
            var valueOld = ensureValue(ov);
            var valueNew = getValue(nv);
            if (valueNew !== undefined && valueNew !== null) {
              validate(valueNew);
              if (valueOld !== valueNew) {
                var items = _this2.indexes[key][valueOld];
                items.splice(items.indexOf(i), 1);
                items.push(i);
              }
            }
          });

          _this2.removes.push(function (item, i) {
            var items = _this2.indexes[key][item[key]];
            items.splice(items.indexOf(i), 1);
          });
        }
      };

      for (var key in indexList) {
        _loop(key);
      }
    }
  }, {
    key: 'ensureIndexes',
    value: function ensureIndexes() {
      this.ensures.forEach(function (ensure) {
        return ensure();
      });
    }
  }, {
    key: 'prepareIndexInsert',
    value: function prepareIndexInsert(val) {
      var result = this.inserts.map(function (item) {
        return item(val);
      });
      return function (i) {
        result.forEach(function (f) {
          return f(i);
        });
      };
    }
  }, {
    key: 'updateIndex',
    value: function updateIndex(ov, nv, i) {
      this.updates.forEach(function (item) {
        return item(ov, nv, i);
      });
    }
  }, {
    key: 'removeIndex',
    value: function removeIndex(val, i) {
      this.removes.forEach(function (item) {
        return item(val, i);
      });
    }
  }, {
    key: 'push',
    value: function push(item) {
      var insert = this.prepareIndexInsert(item);
      var index = this.list.push(item) - 1;
      insert(index);
    }
  }, {
    key: '_traverse',
    value: function _traverse(condition, action) {
      var condFunction = condition instanceof Function;
      var count = condFunction ? 1 : Object.keys(condition).length;

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.list.keys[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var i = _step2.value;

          var mc = 0;
          var current = this.list.get(i);
          if (condFunction) {
            var comp = condition(current);
            if (comp) {
              mc++;
            }
          } else {
            for (var m in condition) {
              if (condition[m] == current[m]) {
                mc++;
              } else {
                break;
              }
            }
          }
          if (mc == count) {
            var next = action(i, current);
            if (!next) {
              break;
            }
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  }, {
    key: 'create',
    value: function create(item) {
      var res = {};
      for (var m in item) {
        res[m] = item[m];
      }
      this.push(res);
      return res;
    }
  }, {
    key: 'findById',
    value: function findById(id) {
      return this.list.get(this.indexes[this.id][id]);
    }
  }, {
    key: 'findBy',
    value: function findBy(key, id) {
      var _this3 = this;

      if (this.indexDefs.hasOwnProperty(key)) {
        if (this.indexDefs[key].unique) {
          return [this.list.get(this.indexes[key][id])];
        } else {
          if (this.indexes[key].hasOwnProperty(id)) {
            return this.indexes[key][id].map(function (i) {
              return _this3.list.get(i);
            });
          }
        }
      }
    }
  }, {
    key: 'find',
    value: function find(condition) {
      var result = [];
      this._traverse(condition, function (i, cur) {
        result.push(cur);
        return true;
      });

      return result;
    }
  }, {
    key: 'findOne',
    value: function findOne(condition) {
      var result = void 0;
      this._traverse(condition, function (i, cur) {
        result = cur;
      });
      return result;
    }
  }, {
    key: 'update',
    value: function update(condition, _update) {
      var _this4 = this;

      this._traverse(condition, function (i, cur) {
        _this4.updateIndex(cur, _update, i);
        for (var u in _update) {
          cur[u] = _update[u];
        }
        return true;
      });
    }
  }, {
    key: 'updateOne',
    value: function updateOne(condition, update) {
      var _this5 = this;

      this._traverse(condition, function (i, cur) {
        _this5.updateIndex(cur, update, i);
        for (var u in update) {
          cur[u] = update[u];
        }
      });
    }
  }, {
    key: 'updateWithId',
    value: function updateWithId(id, update) {
      var result = this.findById(id);
      this.updateIndex(result, update, id);
      for (var u in update) {
        result[u] = update[u];
      }
    }
  }, {
    key: 'removeWithId',
    value: function removeWithId(id) {
      var i = this.indexes[this.id][id];
      var cur = this.list.get(i);
      if (~i && cur) {
        this.removeIndex(cur, i);
        this.list.remove(i);
      }
    }
  }, {
    key: 'remove',
    value: function remove(condition) {
      var _this6 = this;

      this._traverse(condition, function (i, cur) {
        _this6.removeIndex(cur, i);
        _this6.list.remove(i);
        return true;
      });
    }
  }, {
    key: 'removeOne',
    value: function removeOne(condition) {
      var _this7 = this;

      this._traverse(condition, function (i, cur) {
        _this7.removeIndex(cur, i);
        _this7.list.remove(i);
      });
    }
  }]);

  return CollectionBase;
}();

exports.default = CollectionBase;

var CollectionWeb = exports.CollectionWeb = function (_CollectionBase) {
  _inherits(CollectionWeb, _CollectionBase);

  function CollectionWeb(config) {
    _classCallCheck(this, CollectionWeb);

    var _this8 = _possibleConstructorReturn(this, Object.getPrototypeOf(CollectionWeb).call(this, config));

    _this8.storage = config.storage || localStorage;
    return _this8;
  }

  _createClass(CollectionWeb, [{
    key: '__restore',
    value: function __restore() {
      return JSON.parse(this.storage.getItem(this.model));
    }
  }, {
    key: '__store',
    value: function __store(obj) {
      this.storage.setItem(this.model, JSON.stringify(obj));
    }
  }]);

  return CollectionWeb;
}(CollectionBase);

// export class CollectionFile extends CollectionBase {
//   constructor(config) {
//     super(config);
//     this.file = config.format || `${this.model}.json`;

//   }
//   __restore() {
//     fs.ensureFileSync(this.file);
//     return fs.readFileSync(this.file);
//   }
//   __store(obj) {
//     fs.ensureFileSync(this.file);
//     fs.writeFileSync(this.file, JSON.stringify(obj));
//   }
// }

// возможно не работает TTL не удаляются значения индекса.