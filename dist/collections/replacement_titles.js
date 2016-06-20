'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _config = require('../config');

var _config2 = _interopRequireDefault(_config);

var _collection = require('../lib/collection');

var _collection2 = _interopRequireDefault(_collection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
titles_replacements
  title: string
  replacment:
  date:
*/
// reverse mapping to check if the original title is replaced
exports.default = new _collection2.default({
  name: 'replacment_titles',
  id: {
    name: 'replacement',
    auto: false
  },
  ttl: _config2.default.COLLECTION_TTL
});