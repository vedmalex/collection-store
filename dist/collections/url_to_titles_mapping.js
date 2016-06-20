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
url_to_titles_mapping
{
  url: articleId,
  title: storedTitle for article
  date: viisted
}
*/
exports.default = new _collection2.default({
  name: 'urlToTitlesMapping',
  id: {
    name: 'url',
    auto: false
  },
  ttl: _config2.default.COLLECTION_TTL
});