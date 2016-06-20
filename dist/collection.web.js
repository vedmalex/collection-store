'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _collection = require('./collection');

var _collection2 = _interopRequireDefault(_collection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CollectionWeb = function (_CollectionBase) {
  _inherits(CollectionWeb, _CollectionBase);

  function CollectionWeb(config) {
    _classCallCheck(this, CollectionWeb);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(CollectionWeb).call(this, config));

    _this.storage = config.storage || localStorage;
    return _this;
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
}(_collection2.default);

exports.default = CollectionWeb;