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
reported_url_num
{
  url: articleId,
  date: reported Date,
}
*/
exports.default = new _collection2.default({
  name: 'articlesReported',
  id: {
    name: 'url',
    auto: false
  },
  ttl: _config2.default.COLLECTION_TTL
});