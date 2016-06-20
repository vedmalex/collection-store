'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.List = exports.CollectionBase = exports.Collection = undefined;

var _collection = require('./collection.node');

var _collection2 = _interopRequireDefault(_collection);

var _collection3 = require('./collection');

var _collection4 = _interopRequireDefault(_collection3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.Collection = _collection2.default;
exports.CollectionBase = _collection4.default;
exports.List = _collection3.List;