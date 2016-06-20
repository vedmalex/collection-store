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
already_viewed_titles
{
  title,
  date: visited,
}
*/
exports.default = new _collection2.default({
  name: 'alreadyViewedTitles',
  id: {
    name: 'title',
    auto: false
  },
  ttl: _config2.default.COLLECTION_TTL
});