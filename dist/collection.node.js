'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _collection = require('./collection');

var _collection2 = _interopRequireDefault(_collection);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CollectionFile = function (_CollectionBase) {
  _inherits(CollectionFile, _CollectionBase);

  function CollectionFile(config) {
    _classCallCheck(this, CollectionFile);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(CollectionFile).call(this, config));

    _this.file = config.format || _this.model + '.json';
    return _this;
  }

  _createClass(CollectionFile, [{
    key: '__restore',
    value: function __restore() {
      _fsExtra2.default.ensureFileSync(this.file);
      var result = _fsExtra2.default.readFileSync(this.file);
      if (result && result.toString()) {
        return JSON.parse(result);
      }
    }
  }, {
    key: '__store',
    value: function __store(obj) {
      _fsExtra2.default.ensureFileSync(this.file);
      _fsExtra2.default.writeFileSync(this.file, JSON.stringify(obj));
    }
  }]);

  return CollectionFile;
}(_collection2.default);

exports.default = CollectionFile;