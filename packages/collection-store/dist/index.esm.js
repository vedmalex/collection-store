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

// src/query/types.ts
function isQueryOperator(value) {
  return value && typeof value === "object" && typeof value.evaluate === "function";
}

class QueryOperatorError extends Error {
  name;
  operator;
  value;
  constructor(message, operator, value) {
    let valueString = "";
    if (value !== undefined) {
      try {
        valueString = JSON.stringify(value, (_key, val) => typeof val === "bigint" ? val.toString() : val);
      } catch (e) {
        valueString = String(value);
      }
    }
    super(`${operator}: ${message}${valueString ? ` (value: ${valueString})` : ""}`);
    this.name = "QueryOperatorError";
    this.operator = operator;
    this.value = value;
  }
}
// src/query/logical.ts
class AndOperator {
  type = "logical";
  conditions;
  constructor(conditions) {
    if (!Array.isArray(conditions)) {
      throw new QueryOperatorError("$and requires an array of conditions", "$and", conditions);
    }
    this.conditions = conditions.map((condition) => {
      if (!condition || typeof condition !== "object") {
        throw new QueryOperatorError("Each condition in $and must be an object", "$and", condition);
      }
      return condition;
    });
  }
  evaluate(value, context) {
    return this.conditions.every((condition) => condition.evaluate(value, context));
  }
}

class OrOperator {
  type = "logical";
  conditions;
  constructor(conditions) {
    if (!Array.isArray(conditions)) {
      throw new QueryOperatorError("$or requires an array of conditions", "$or", conditions);
    }
    this.conditions = conditions.map((condition) => {
      if (!condition || typeof condition !== "object") {
        throw new QueryOperatorError("Each condition in $or must be an object", "$or", condition);
      }
      return condition;
    });
  }
  evaluate(value, context) {
    return this.conditions.some((condition) => condition.evaluate(value, context));
  }
}

class NotOperator {
  type = "logical";
  condition;
  constructor(condition) {
    if (!isQueryOperator(condition)) {
      throw new QueryOperatorError("$not requires a valid QueryOperator object condition", "$not", condition);
    }
    this.condition = condition;
  }
  evaluate(value, context) {
    return !this.condition.evaluate(value, context);
  }
}

class NorOperator {
  type = "logical";
  conditions;
  constructor(conditions) {
    if (!Array.isArray(conditions)) {
      throw new QueryOperatorError("$nor requires an array of conditions", "$nor", conditions);
    }
    this.conditions = conditions.map((condition) => {
      if (!condition || typeof condition !== "object") {
        throw new QueryOperatorError("Each condition in $nor must be an object", "$nor", condition);
      }
      return condition;
    });
  }
  evaluate(value, context) {
    return !this.conditions.some((condition) => condition.evaluate(value, context));
  }
}
var logicalOperators = {
  $and: AndOperator,
  $or: OrOperator,
  $not: NotOperator,
  $nor: NorOperator
};
// src/query/element.ts
class ExistsOperator {
  type = "element";
  shouldExist;
  constructor(value) {
    if (typeof value !== "boolean") {
      throw new QueryOperatorError("$exists requires a boolean value", "$exists", value);
    }
    this.shouldExist = value;
  }
  evaluate(value) {
    return this.shouldExist ? value !== undefined : value === undefined;
  }
}

class TypeOperator {
  type = "element";
  checkers;
  static typeCheckers = {
    double: (v) => typeof v === "number" && !Number.isInteger(v),
    1: (v) => typeof v === "number" && !Number.isInteger(v),
    string: (v) => typeof v === "string",
    2: (v) => typeof v === "string",
    object: (v) => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp) && !(v instanceof Uint8Array) && !(typeof Buffer !== "undefined" && v instanceof Buffer) && v._bsontype !== "ObjectId",
    3: (v) => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp) && !(v instanceof Uint8Array) && !(typeof Buffer !== "undefined" && v instanceof Buffer) && v._bsontype !== "ObjectId",
    array: (v) => Array.isArray(v),
    4: (v) => Array.isArray(v),
    binData: (v) => v instanceof Uint8Array || typeof Buffer !== "undefined" && v instanceof Buffer,
    5: (v) => v instanceof Uint8Array || typeof Buffer !== "undefined" && v instanceof Buffer,
    undefined: (v) => v === undefined,
    6: (v) => v === undefined,
    objectId: (v) => typeof v === "object" && v !== null && v._bsontype === "ObjectId",
    7: (v) => typeof v === "object" && v !== null && v._bsontype === "ObjectId",
    bool: (v) => typeof v === "boolean",
    boolean: (v) => typeof v === "boolean",
    8: (v) => typeof v === "boolean",
    date: (v) => v instanceof Date,
    9: (v) => v instanceof Date,
    null: (v) => v === null,
    10: (v) => v === null,
    regex: (v) => v instanceof RegExp,
    11: (v) => v instanceof RegExp,
    int: (v) => typeof v === "number" && Number.isInteger(v),
    16: (v) => typeof v === "number" && Number.isInteger(v),
    long: (v) => typeof v === "bigint" || typeof v === "number" && Number.isInteger(v),
    18: (v) => typeof v === "bigint" || typeof v === "number" && Number.isInteger(v),
    number: (v) => typeof v === "number" || typeof v === "bigint"
  };
  constructor(value) {
    const typesToMatch = Array.isArray(value) ? value : [value];
    if (!typesToMatch.every((t) => typeof t === "string" || typeof t === "number")) {
      throw new QueryOperatorError("$type requires a BSON type string/number or an array of them", "$type", value);
    }
    this.checkers = typesToMatch.map((t) => {
      const checker = TypeOperator.typeCheckers[t];
      if (!checker) {
        throw new QueryOperatorError(`Unsupported BSON type specified: ${t}`, "$type", t);
      }
      return checker;
    });
    if (this.checkers.length === 0) {
      throw new QueryOperatorError("No valid BSON types provided", "$type", value);
    }
  }
  evaluate(value, _context) {
    return this.checkers.some((checker) => checker(value));
  }
}
var elementOperators = {
  $exists: ExistsOperator,
  $type: TypeOperator
};
// src/query/comparison.ts
var BSON_TYPE_ORDER = {
  null: 1,
  number: 2,
  string: 3,
  object: 4,
  array: 5,
  boolean: 8,
  date: 9
};
function getBSONTypeOrder(value) {
  if (value === null)
    return BSON_TYPE_ORDER.null;
  const jsType = typeof value;
  if (jsType === "number" || jsType === "bigint")
    return BSON_TYPE_ORDER.number;
  if (jsType === "string")
    return BSON_TYPE_ORDER.string;
  if (jsType === "boolean")
    return BSON_TYPE_ORDER.boolean;
  if (value instanceof Date)
    return BSON_TYPE_ORDER.date;
  if (Array.isArray(value))
    return BSON_TYPE_ORDER.array;
  if (jsType === "object")
    return BSON_TYPE_ORDER.object;
  return Infinity;
}
function compareBSONValues(v1, v2) {
  if (v1 === undefined || v2 === undefined) {
    if (v1 === undefined && v2 === undefined)
      return 0;
    return null;
  }
  if (deepCompare(v1, v2)) {
    return 0;
  }
  const typeOrder1 = getBSONTypeOrder(v1);
  const typeOrder2 = getBSONTypeOrder(v2);
  if (typeOrder1 !== typeOrder2) {
    return typeOrder1 < typeOrder2 ? -1 : 1;
  }
  if (typeOrder1 === BSON_TYPE_ORDER.number) {
    try {
      const n1 = typeof v1 === "bigint" ? v1 : BigInt(v1);
      const n2 = typeof v2 === "bigint" ? v2 : BigInt(v2);
      return n1 < n2 ? -1 : n1 > n2 ? 1 : 0;
    } catch {
      const n1 = v1;
      const n2 = v2;
      if (n1 < n2)
        return -1;
      if (n1 > n2)
        return 1;
      if (isNaN(n1) && isNaN(n2))
        return 0;
      if (isNaN(n1) || isNaN(n2))
        return isNaN(n1) ? -1 : 1;
      return 0;
    }
  }
  if (typeOrder1 === BSON_TYPE_ORDER.string) {
    return v1 < v2 ? -1 : 1;
  }
  if (typeOrder1 === BSON_TYPE_ORDER.date) {
    const time1 = v1.getTime();
    const time2 = v2.getTime();
    return time1 < time2 ? -1 : time1 > time2 ? 1 : 0;
  }
  if (typeOrder1 === BSON_TYPE_ORDER.boolean) {
    return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
  }
  if (typeOrder1 === BSON_TYPE_ORDER.array) {
    const arr1 = v1;
    const arr2 = v2;
    const len = Math.min(arr1.length, arr2.length);
    for (let i = 0;i < len; i++) {
      const comp = compareBSONValues(arr1[i], arr2[i]);
      if (comp !== 0 && comp !== null) {
        return comp;
      }
    }
    return arr1.length < arr2.length ? -1 : arr1.length > arr2.length ? 1 : 0;
  }
  return 0;
}
function deepCompare(val1, val2) {
  if (val1 === val2) {
    return true;
  }
  if (val1 instanceof Date && val2 instanceof Date) {
    return val1.getTime() === val2.getTime();
  }
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) {
      return false;
    }
    for (let i = 0;i < val1.length; i++) {
      if (!deepCompare(val1[i], val2[i])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

class EqOperator {
  type = "comparison";
  queryValue;
  constructor(value) {
    this.queryValue = value;
  }
  evaluate(value, _context) {
    if (this.queryValue === undefined) {
      return value === undefined;
    }
    if (value === undefined && this.queryValue !== undefined) {
      return false;
    }
    return deepCompare(value, this.queryValue);
  }
}

class NeOperator {
  type = "comparison";
  queryValue;
  constructor(value) {
    this.queryValue = value;
  }
  evaluate(value, _context) {
    if (this.queryValue === undefined) {
      return value !== undefined;
    }
    if (value === undefined && this.queryValue !== undefined) {
      return true;
    }
    return !deepCompare(value, this.queryValue);
  }
}

class GtOperator {
  type = "comparison";
  queryValue;
  constructor(value) {
    this.queryValue = value;
  }
  evaluate(value, _context) {
    return compareBSONValues(value, this.queryValue) === 1;
  }
}

class GteOperator {
  type = "comparison";
  queryValue;
  constructor(value) {
    this.queryValue = value;
  }
  evaluate(value, _context) {
    const comparison = compareBSONValues(value, this.queryValue);
    return comparison === 1 || comparison === 0;
  }
}

class LtOperator {
  type = "comparison";
  queryValue;
  constructor(value) {
    this.queryValue = value;
  }
  evaluate(value, _context) {
    return compareBSONValues(value, this.queryValue) === -1;
  }
}

class LteOperator {
  type = "comparison";
  queryValue;
  constructor(value) {
    this.queryValue = value;
  }
  evaluate(value, _context) {
    const comparison = compareBSONValues(value, this.queryValue);
    return comparison === -1 || comparison === 0;
  }
}

class InOperator {
  type = "comparison";
  queryValues;
  constructor(value) {
    if (!Array.isArray(value)) {
      throw new QueryOperatorError("$in requires an array", "$in", value);
    }
    this.queryValues = value;
  }
  evaluate(value, _context) {
    const directMatch = this.queryValues.some((item) => {
      if (item instanceof RegExp) {
        return typeof value === "string" && item.test(value);
      }
      return compareBSONValues(value, item) === 0;
    });
    if (directMatch) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.some((fieldItem) => this.queryValues.some((queryItem) => {
        if (queryItem instanceof RegExp) {
          return typeof fieldItem === "string" && queryItem.test(fieldItem);
        }
        return compareBSONValues(fieldItem, queryItem) === 0;
      }));
    }
    return false;
  }
}

class NinOperator {
  type = "comparison";
  queryValues;
  constructor(value) {
    if (!Array.isArray(value)) {
      throw new QueryOperatorError("$nin requires an array", "$nin", value);
    }
    this.queryValues = value;
  }
  evaluate(value, _context) {
    const directMatch = this.queryValues.some((item) => {
      if (item instanceof RegExp) {
        return typeof value === "string" && item.test(value);
      }
      return compareBSONValues(value, item) === 0;
    });
    if (directMatch) {
      return false;
    }
    if (Array.isArray(value)) {
      const foundMatch = value.some((fieldItem) => this.queryValues.some((queryItem) => {
        if (queryItem instanceof RegExp) {
          return typeof fieldItem === "string" && queryItem.test(fieldItem);
        }
        return compareBSONValues(fieldItem, queryItem) === 0;
      }));
      return !foundMatch;
    }
    return true;
  }
}
var comparisonOperators = {
  $eq: EqOperator,
  $ne: NeOperator,
  $gt: GtOperator,
  $gte: GteOperator,
  $lt: LtOperator,
  $lte: LteOperator,
  $in: InOperator,
  $nin: NinOperator
};

// src/query/array.ts
class AllOperator {
  type = "array";
  values;
  constructor(value) {
    if (!Array.isArray(value)) {
      throw new QueryOperatorError("$all requires an array", "$all", value);
    }
    this.values = value;
  }
  evaluate(value) {
    if (!Array.isArray(value)) {
      return this.values.length === 1 && compareBSONValues(value, this.values[0]) === 0;
    }
    return this.values.every((queryItem) => value.some((fieldItem) => compareBSONValues(fieldItem, queryItem) === 0));
  }
}

class ElemMatchOperator {
  type = "array";
  condition;
  constructor(condition) {
    if (typeof condition !== "function") {
      throw new QueryOperatorError("$elemMatch requires a condition function", "$elemMatch", condition);
    }
    this.condition = condition;
  }
  evaluate(value) {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.some((item) => this.condition(item));
  }
}

class SizeOperator {
  type = "array";
  expectedSize;
  constructor(value) {
    if (typeof value !== "number" || value < 0 || !Number.isInteger(value)) {
      throw new QueryOperatorError("$size requires a non-negative integer", "$size", value);
    }
    this.expectedSize = value;
  }
  evaluate(value) {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.length === this.expectedSize;
  }
}
var arrayOperators = {
  $all: AllOperator,
  $elemMatch: ElemMatchOperator,
  $size: SizeOperator
};
// src/query/evaluation.ts
class ModOperator {
  type = "evaluation";
  divisor;
  remainder;
  constructor(value) {
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "number" && typeof value[0] !== "bigint" || typeof value[1] !== "number" && typeof value[1] !== "bigint") {
      throw new QueryOperatorError("$mod requires an array of two numbers or bigints [divisor, remainder]", "$mod", value);
    }
    const [divisor, remainder] = value;
    if (typeof divisor === "number" && divisor === 0 || typeof divisor === "bigint" && divisor === BigInt(0)) {
      throw new QueryOperatorError("$mod divisor cannot be zero", "$mod", value);
    }
    this.divisor = divisor;
    this.remainder = remainder;
  }
  evaluate(value) {
    if (typeof value !== "number" && typeof value !== "bigint") {
      return false;
    }
    try {
      if (typeof value === "bigint" || typeof this.divisor === "bigint" || typeof this.remainder === "bigint") {
        const bigIntValue = BigInt(value);
        const bigIntDivisor = BigInt(this.divisor);
        const bigIntRemainder = BigInt(this.remainder);
        return bigIntValue % bigIntDivisor === bigIntRemainder;
      }
      return value % this.divisor === this.remainder;
    } catch (e) {
      return false;
    }
  }
}

class RegexOperator {
  type = "evaluation";
  pattern;
  constructor(value) {
    let regexValue;
    let options = undefined;
    if (value instanceof RegExp) {
      this.pattern = value;
      return;
    } else if (typeof value === "string") {
      regexValue = value;
    } else if (typeof value === "object" && value !== null && "$regex" in value) {
      const regexPart = value.$regex;
      if (regexPart instanceof RegExp) {
        this.pattern = regexPart;
        return;
      } else if (typeof regexPart === "string") {
        regexValue = regexPart;
        options = value.$options;
        if (options !== undefined && typeof options !== "string") {
          throw new QueryOperatorError("$regex operator $options must be a string", "$regex", value);
        }
      } else {
        throw new QueryOperatorError("$regex value must be a string or RegExp", "$regex", value);
      }
    } else {
      throw new QueryOperatorError("$regex requires a string, RegExp, or { $regex, $options } object", "$regex", value);
    }
    try {
      this.pattern = new RegExp(regexValue, options);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new QueryOperatorError(`Invalid regular expression or options: ${message}`, "$regex", value);
    }
  }
  evaluate(value) {
    if (typeof value !== "string") {
      return false;
    }
    return this.pattern.test(value);
  }
}

class WhereOperator {
  type = "evaluation";
  fn;
  constructor(value) {
    if (typeof value === "function") {
      this.fn = value;
    } else if (typeof value === "string") {
      console.warn("Using string-based $where is a potential security risk and may impact performance. Ensure the code is trusted.");
      try {
        this.fn = new Function("obj", `return (${value})`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new QueryOperatorError(`Invalid $where JavaScript expression: ${message}`, "$where", value);
      }
    } else {
      throw new QueryOperatorError("$where requires a string expression or a function", "$where", value);
    }
  }
  evaluate(_value, context) {
    if (typeof context !== "object" || context === null) {
      return false;
    }
    try {
      return Boolean(this.fn.call(context, context));
    } catch (e) {
      console.error(`Error executing $where function: ${e instanceof Error ? e.message : String(e)}`, context);
      return false;
    }
  }
}
var evaluationOperators = {
  $mod: ModOperator,
  $regex: RegexOperator,
  $where: WhereOperator
};
// src/query/bitwise.ts
function validateBitMask(value) {
  if (typeof value === "number") {
    const numValue = value;
    if (!Number.isInteger(numValue)) {
      throw new QueryOperatorError("Bitmask must be an integer", "bitwise", value);
    }
    if (numValue < 0) {
      throw new QueryOperatorError("Bitmask must be a non-negative integer", "bitwise", value);
    }
    return numValue;
  }
  if (Array.isArray(value)) {
    if (value.every((bit) => typeof bit === "number" && Number.isInteger(bit) && bit >= 0)) {
      const numericArray = value;
      return numericArray.reduce((mask, bit) => mask | 1 << bit, 0);
    } else {
      throw new QueryOperatorError("Bit position array must contain only non-negative integers", "bitwise", value);
    }
  }
  throw new QueryOperatorError("Invalid bit mask or positions: Must be a non-negative integer or array of non-negative integers", "bitwise", value);
}

class BitsAllSetOperator {
  type = "bitwise";
  bitmask;
  constructor(value) {
    this.bitmask = validateBitMask(value);
  }
  evaluate(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return false;
    }
    return (value & this.bitmask) === this.bitmask;
  }
}

class BitsAnySetOperator {
  type = "bitwise";
  bitmask;
  constructor(value) {
    this.bitmask = validateBitMask(value);
  }
  evaluate(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return false;
    }
    return (value & this.bitmask) !== 0;
  }
}

class BitsAllClearOperator {
  type = "bitwise";
  bitmask;
  constructor(value) {
    this.bitmask = validateBitMask(value);
  }
  evaluate(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return false;
    }
    return (value & this.bitmask) === 0;
  }
}

class BitsAnyClearOperator {
  type = "bitwise";
  bitmask;
  constructor(value) {
    this.bitmask = validateBitMask(value);
  }
  evaluate(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return false;
    }
    return (value & this.bitmask) !== this.bitmask;
  }
}
var bitwiseOperators = {
  $bitsAllSet: BitsAllSetOperator,
  $bitsAnySet: BitsAnySetOperator,
  $bitsAllClear: BitsAllClearOperator,
  $bitsAnyClear: BitsAnyClearOperator
};
// src/query/text.ts
class TextSearchOperatorImpl {
  type = "text";
  searchTerms;
  caseSensitive;
  diacriticSensitive;
  constructor(value) {
    if (!value || typeof value !== "object") {
      throw new QueryOperatorError("$text requires an object with $search", "$text", value);
    }
    const options = value;
    if (typeof options.$search !== "string") {
      throw new QueryOperatorError("$text.$search must be a string", "$text", value);
    }
    this.searchTerms = options.$search.split(/\s+/).filter((term) => term.length > 0).map((term) => term.trim());
    if (this.searchTerms.length === 0) {
      throw new QueryOperatorError("$text.$search cannot be empty", "$text", value);
    }
    this.caseSensitive = options.$caseSensitive === true;
    this.diacriticSensitive = options.$diacriticSensitive === true;
  }
  evaluate(value) {
    if (typeof value !== "string") {
      return false;
    }
    let searchText = value;
    let terms = this.searchTerms;
    if (!this.caseSensitive) {
      searchText = searchText.toLowerCase();
      terms = terms.map((term) => term.toLowerCase());
    }
    if (!this.diacriticSensitive) {
      searchText = this.removeDiacritics(searchText);
      terms = terms.map((term) => this.removeDiacritics(term));
    }
    return terms.every((term) => searchText.includes(term));
  }
  removeDiacritics(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}
var textSearchOperators = {
  $text: TextSearchOperatorImpl
};
// src/query/QueryType.ts
function isSingleField(inp) {
  return typeof inp === "object" && inp !== null && !Array.isArray(inp) && Object.keys(inp).length === 1;
}
function isNotSingleField(inp) {
  return typeof inp === "object" && inp !== null && !Array.isArray(inp) && Object.keys(inp).length > 1;
}

// src/query/build_query.ts
function buildIt_new(obj, options) {
  if (obj instanceof RegExp) {
    try {
      const op = createOperator("$regex", obj);
      return (fieldValue) => {
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((item) => op.evaluate(item));
        }
        return op.evaluate(fieldValue);
      };
    } catch (e) {
      if (e instanceof QueryOperatorError)
        throw e;
      throw new Error(`Error creating RegExp operator: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return (input2) => compareBSONValues(input2, obj) === 0;
  }
  if (typeof obj === "object" && obj !== null && "$regex" in obj) {
    const keys = Object.keys(obj);
    const hasOnlyRegexAndOptions = keys.every((k) => k === "$regex" || k === "$options");
    if (hasOnlyRegexAndOptions && keys.length >= 1 && keys.length <= 2) {
      try {
        const op = createOperator("$regex", obj);
        return (fieldValue) => {
          if (Array.isArray(fieldValue)) {
            return fieldValue.some((item) => op.evaluate(item));
          }
          return op.evaluate(fieldValue);
        };
      } catch (e) {
        if (e instanceof QueryOperatorError)
          throw e;
        throw new Error(`Error creating $regex operator: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      throw new Error(`Invalid object structure containing $regex mixed with other keys: ${JSON.stringify(obj)}`);
    }
  }
  if (isNotSingleField(obj)) {
    const keys = Object.keys(obj);
    const conditions = keys.map((prop) => {
      return make_call_new(obj, prop, options);
    });
    return (input2) => conditions.every((cond) => cond(input2));
  } else if (isSingleField(obj)) {
    const prop = Object.keys(obj)[0];
    const call = make_call_new(obj, prop, options);
    return (input2) => call(input2);
  } else {
    return (input2) => compareBSONValues(input2, obj) === 0;
  }
}
function make_call_new(obj, prop, options) {
  if (options?.[prop]) {
    return options[prop](obj[prop]);
  }
  switch (prop) {
    case "$and": {
      if (!Array.isArray(obj.$and)) {
        throw new QueryOperatorError("$and requires an array", "$and", obj.$and);
      }
      const conditions = obj.$and.map((q) => buildIt_new(q, options));
      return (input2) => conditions.every((cond) => cond(input2));
    }
    case "$or": {
      if (!Array.isArray(obj.$or)) {
        throw new QueryOperatorError("$or requires an array", "$or", obj.$or);
      }
      const conditions = obj.$or.map((q) => buildIt_new(q, options));
      return (input2) => conditions.some((cond) => cond(input2));
    }
    case "$not": {
      const condition = buildIt_new(obj.$not, options);
      return (input2) => !condition(input2);
    }
    case "$nor": {
      if (!Array.isArray(obj.$nor)) {
        throw new QueryOperatorError("$nor requires an array", "$nor", obj.$nor);
      }
      const conditions = obj.$nor.map((q) => buildIt_new(q, options));
      return (input2) => !conditions.some((cond) => cond(input2));
    }
    case "$where": {
      try {
        const op = createOperator("$where", obj.$where);
        return (doc) => op.evaluate(undefined, doc);
      } catch (e) {
        if (e instanceof QueryOperatorError)
          throw e;
        throw new Error(`Error creating $where operator: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    case "$elemMatch": {
      if (typeof obj.$elemMatch !== "object" || obj.$elemMatch === null || Array.isArray(obj.$elemMatch)) {
        throw new QueryOperatorError("$elemMatch requires a query object value", "$elemMatch", obj.$elemMatch);
      }
      const elementCondition = buildIt_new(obj.$elemMatch, options);
      const op = new ElemMatchOperator(elementCondition);
      return (fieldValue) => op.evaluate(fieldValue);
    }
  }
  if (isOperator(prop)) {
    try {
      const op = createOperator(prop, obj[prop]);
      return (fieldValue) => {
        if (Array.isArray(fieldValue) && !["$all", "$size", "$elemMatch", "$type", "$exists", "$nin", "$in"].includes(prop)) {
          return fieldValue.some((item) => op.evaluate(item));
        }
        return op.evaluate(fieldValue);
      };
    } catch (e) {
      if (e instanceof QueryOperatorError)
        throw e;
      throw new Error(`Error creating ${prop} operator: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const compiledCondition = buildIt_new(obj[prop], options);
  return (doc) => {
    const parts = prop.split(".");
    let fieldValue = doc;
    for (const part of parts) {
      if (typeof fieldValue !== "object" || fieldValue === null || !(part in fieldValue)) {
        fieldValue = undefined;
        break;
      }
      fieldValue = fieldValue[part];
    }
    return compiledCondition(fieldValue);
  };
}
function build_query_new(input2, options) {
  try {
    const result = buildIt_new(input2, options);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    let inputString = "";
    try {
      inputString = JSON.stringify(input2, null, 2);
    } catch {
      inputString = String(input2);
    }
    throw new Error(`Invalid query object or definition: ${message}. Input: ${inputString}`);
  }
}

// src/query/js_types.ts
function getJsType(value) {
  if (value === null)
    return "null";
  if (value === undefined)
    return "undefined";
  const jsType = typeof value;
  if (jsType === "string")
    return "string";
  if (jsType === "boolean")
    return "boolean";
  if (jsType === "number")
    return "number";
  if (value instanceof Date)
    return "date";
  if (value instanceof RegExp)
    return "regexp";
  if (typeof Buffer !== "undefined" && value instanceof Buffer)
    return "buffer";
  if (Array.isArray(value))
    return "array";
  if (jsType === "object")
    return "object";
  return null;
}

// src/query/compare_utils.ts
var JS_TYPE_ORDER = {
  null: 0,
  undefined: 1,
  boolean: 2,
  number: 3,
  string: 4,
  date: 5,
  regexp: 6,
  array: 7,
  object: 8
};
function getJsTypeOrder(value) {
  const type = getJsType(value);
  return type ? JS_TYPE_ORDER[type] ?? Infinity : Infinity;
}
function compareValues(v1, v2) {
  if (v1 === undefined || v2 === undefined) {
    return null;
  }
  if (deepCompare2(v1, v2)) {
    return 0;
  }
  const typeOrder1 = getJsTypeOrder(v1);
  const typeOrder2 = getJsTypeOrder(v2);
  if (typeOrder1 !== typeOrder2) {
    return typeOrder1 < typeOrder2 ? -1 : 1;
  }
  if (typeof v1 === "number" && typeof v2 === "number") {
    return v1 < v2 ? -1 : 1;
  }
  if (typeof v1 === "string" && typeof v2 === "string") {
    return v1 < v2 ? -1 : 1;
  }
  if (typeof v1 === "boolean" && typeof v2 === "boolean") {
    return v1 === false && v2 === true ? -1 : 1;
  }
  if (v1 instanceof Date && v2 instanceof Date) {
    const time1 = v1.getTime();
    const time2 = v2.getTime();
    return time1 < time2 ? -1 : 1;
  }
  if (typeOrder1 === JS_TYPE_ORDER.array) {
    return null;
  }
  return null;
}
function deepCompare2(v1, v2) {
  if (v1 === v2) {
    return true;
  }
  if (v1 instanceof Date && v2 instanceof Date) {
    return v1.getTime() === v2.getTime();
  }
  if (Array.isArray(v1) && Array.isArray(v2)) {
    if (v1.length !== v2.length) {
      return false;
    }
    for (let i = 0;i < v1.length; i++) {
      if (!deepCompare2(v1[i], v2[i])) {
        return false;
      }
    }
    return true;
  }
  if (typeof v1 === "object" && v1 !== null && typeof v2 === "object" && v2 !== null && !(v1 instanceof Date) && !(v2 instanceof Date) && !Array.isArray(v1) && !Array.isArray(v2) && !(v1 instanceof RegExp) && !(v2 instanceof RegExp) && !(typeof Buffer !== "undefined" && v1 instanceof Buffer) && !(typeof Buffer !== "undefined" && v2 instanceof Buffer)) {
    const keys1 = Object.keys(v1);
    const keys2 = Object.keys(v2);
    if (keys1.length !== keys2.length) {
      return false;
    }
    for (const key2 of keys1) {
      if (!Object.prototype.hasOwnProperty.call(v2, key2) || !deepCompare2(v1[key2], v2[key2])) {
        return false;
      }
    }
    return true;
  }
  if (v1 instanceof RegExp && v2 instanceof RegExp) {
    return v1.source === v2.source && v1.flags === v2.flags;
  }
  return false;
}

// src/query/compile_query.ts
function isLogicalOperator(key2) {
  return key2 === "$and" || key2 === "$or" || key2 === "$not" || key2 === "$nor";
}
function compileQuery(query, options) {
  const context = {
    values: [],
    options,
    regexCache: {},
    regexToCreate: [],
    whereOperators: [],
    getNextValueIndex: () => context.values.length,
    getRegexVar: (pattern, flags) => {
      const cacheKey = `${pattern}\x00${flags}`;
      if (context.regexCache[cacheKey]) {
        return context.regexCache[cacheKey];
      }
      const varName = `_regex${context.regexToCreate.length}`;
      const patternIndex = addValueAndGetCode(pattern, context, true);
      const flagsIndex = addValueAndGetCode(flags, context, true);
      context.regexToCreate.push({ varName, patternIndex, flagsIndex });
      context.regexCache[cacheKey] = varName;
      return varName;
    }
  };
  try {
    const mainCodeString = buildCodeRecursive(query, "doc", context);
    const queryValues = [...context.values];
    const whereOperators = context.whereOperators;
    const externalHelpers = {
      compareValues,
      deepCompare: deepCompare2,
      _getJsTypeHelper: getJsType
    };
    const helperNames = Object.keys(externalHelpers);
    const regexInstances = [];
    let regexDeclarationForCodeString = "";
    let regexAssignmentForFuncBody = "";
    context.regexToCreate.forEach(({ varName, patternIndex, flagsIndex }, index) => {
      const pattern = context.values[parseInt(patternIndex.substring(8, patternIndex.length - 1))];
      const flags = context.values[parseInt(flagsIndex.substring(8, flagsIndex.length - 1))];
      regexDeclarationForCodeString += `    let ${varName}; // Declaration
`;
      regexAssignmentForFuncBody += `  ${varName} = _regexInstances[${index}]; // Assignment from bound array
`;
      try {
        regexInstances.push(new RegExp(pattern, flags));
      } catch (regexError) {
        regexInstances.push(null);
        console.error(`Error creating RegExp (${varName}):`, regexError instanceof Error ? regexError.message : regexError);
      }
    });
    const codeString = `
(doc) => {
    // --- Outer Scope Variables (captured/bound dependencies) ---
    // Helpers (available via closure/binding):
    ${helperNames.map((name2) => `// const ${name2} = /* bound helper function */;`).join(`
    `)}
    // Query Values (available via closure/binding):
    const _values = ${JSON.stringify(queryValues)}; // Show values used
    // Where Operators (available via closure/binding):
    const _whereOps = [ /* bound WhereOperator instances */ ];
    // RegExp Instances (created once, available via closure/binding):
${regexDeclarationForCodeString.trim()}

    // --- Runtime Logic ---
    try {
        // Note: Inside this block, references like _regex0, _values[N], compareBSONValues are resolved
        // using the variables made available from the outer scope/binding.
        const result = !!(${mainCodeString});

        // $where operator check (runs within the runtime function)
        if (result && _whereOps.length > 0) {
            if (!_whereOps.every(op => {
                let whereResult = false;
                try {
                    whereResult = op.evaluate(null, doc);
                    return whereResult;
                } catch (whereError) {
                    console.error("Error during compiled $where execution:", whereError);
                    return false; // Treat $where error as false match
                }
            })) {
                return false;
            }
        }
        return result;
      } catch (e) {
        console.error("Error during compiled query execution:", e instanceof Error ? e.message : String(e));
        return false;
      }
}`;
    const runtimeFuncBody = `
            // Make helpers and values available from bound arguments
            ${helperNames.map((name2) => `const ${name2} = _helpers.${name2};`).join(`
`)}
            const _values = _queryValues;
            const _whereOps = _whereOperators;
            // Assign pre-compiled regex instances from bound arguments
            ${regexAssignmentForFuncBody.trim()}

            // --- Runtime Logic ---
            try {
                const result = !!(${mainCodeString});

                // $where check logic
                 if (result && _whereOps.length > 0) {
                     if (!_whereOps.every(op => {
                         let whereResult = false;
                         try {
                             whereResult = op.evaluate(null, doc);
                             return whereResult;
                         } catch (whereError) {
                             console.error("Error during compiled $where execution:", whereError);
                             return false;
                         }
                     })) {
                         return false;
                     }
                 }
                return result;
            } catch (e) {
                console.error("Error during compiled query execution:", e instanceof Error ? e.message : String(e));
                return false;
            }
        `;
    const CompiledRuntimeFunction = new Function("_helpers", "_queryValues", "_whereOperators", "_regexInstances", "doc", runtimeFuncBody);
    const compiledFunc = CompiledRuntimeFunction.bind(null, externalHelpers, queryValues, whereOperators, regexInstances);
    return {
      code: codeString.trim(),
      func: compiledFunc
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Error during query compilation:", message, e);
    return {
      code: `// Compilation Error: ${message}`,
      func: () => {
        throw new Error(`Query compilation failed: ${message}`);
      },
      error: message,
      errorDetails: e
    };
  }
}
function addValueAndGetCode(value, context, store = false) {
  const index = context.getNextValueIndex();
  context.values.push(value);
  return store ? `_values[${index}]` : `_values[${index}]`;
}
function buildCodeRecursive(queryPart, docVar, context) {
  if (queryPart instanceof RegExp) {
    const pattern = queryPart.source;
    const flags = queryPart.flags;
    if (/[^gimsuy]/.test(flags)) {
      throw new QueryOperatorError(`Invalid regex flags specified in RegExp: ${flags}`, "$regex", queryPart);
    }
    const regexVar = context.getRegexVar(pattern, flags);
    return `(${regexVar} !== null && typeof ${docVar} === 'string' && ${regexVar}.test(${docVar}))`;
  }
  if (typeof queryPart !== "object" || queryPart === null || Array.isArray(queryPart)) {
    const valueCode = addValueAndGetCode(queryPart, context);
    return `deepCompare(${docVar}, ${valueCode})`;
  }
  const keys = Object.keys(queryPart);
  const queryRecord = queryPart;
  if (keys.length === 1) {
    const key2 = keys[0];
    const value = queryRecord[key2];
    if (isLogicalOperator(key2) || key2 === "$where") {
      if (key2 === "$where") {
        compileOperator(key2, value, docVar, context);
        return "true";
      }
      switch (key2) {
        case "$and":
          if (!Array.isArray(value))
            throw new QueryOperatorError("$and requires an array", key2, value);
          return value.map((subQuery) => `(${buildCodeRecursive(subQuery, docVar, context)})`).join(" && ") || "true";
        case "$or":
          if (!Array.isArray(value))
            throw new QueryOperatorError("$or requires an array", key2, value);
          return value.map((subQuery) => `(${buildCodeRecursive(subQuery, docVar, context)})`).join(" || ") || "false";
        case "$not":
          return `!(${buildCodeRecursive(value, docVar, context)})`;
        case "$nor":
          if (!Array.isArray(value))
            throw new QueryOperatorError("$nor requires an array", key2, value);
          return value.map((subQuery) => `!(${buildCodeRecursive(subQuery, docVar, context)})`).join(" && ") || "true";
      }
    }
    if (key2.startsWith("$")) {
      return compileOperator(key2, value, docVar, context);
    }
  }
  if ("$regex" in queryRecord && keys.includes("$regex")) {
    return compileOperator("$regex", queryPart, docVar, context);
  }
  if (keys.length > 1 && keys.every((key2) => key2.startsWith("$"))) {
    const operatorConditions = keys.map((key2) => {
      const value = queryRecord[key2];
      return compileOperator(key2, value, docVar, context);
    });
    return operatorConditions.join(" && ");
  }
  const fieldConditions = keys.map((key2) => {
    if (key2 === "$where") {
      compileOperator(key2, queryRecord[key2], docVar, context);
      return "true";
    }
    if (isLogicalOperator(key2)) {
      const value2 = queryRecord[key2];
      switch (key2) {
        case "$and":
          if (!Array.isArray(value2))
            throw new QueryOperatorError("$and requires an array", key2, value2);
          return "(" + (value2.map((subQuery) => `(${buildCodeRecursive(subQuery, docVar, context)})`).join(" && ") || "true") + ")";
        case "$or":
          if (!Array.isArray(value2))
            throw new QueryOperatorError("$or requires an array", key2, value2);
          return "(" + (value2.map((subQuery) => `(${buildCodeRecursive(subQuery, docVar, context)})`).join(" || ") || "false") + ")";
        case "$not":
          return `!(${buildCodeRecursive(value2, docVar, context)})`;
        case "$nor":
          if (!Array.isArray(value2))
            throw new QueryOperatorError("$nor requires an array", key2, value2);
          return "(" + (value2.map((subQuery) => `!(${buildCodeRecursive(subQuery, docVar, context)})`).join(" && ") || "true") + ")";
      }
    }
    const value = queryRecord[key2];
    const safeAccessVar = key2.split(".").reduce((acc, part) => {
      if (!/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(part)) {
        const escapedPart = part.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        return `${acc}?.["${escapedPart}"]`;
      }
      return `${acc}?.${part}`;
    }, docVar);
    return buildCodeRecursive(value, safeAccessVar, context);
  });
  const actualConditions = fieldConditions.filter((c) => c !== "true");
  if (actualConditions.length === 0)
    return "true";
  return actualConditions.join(" && ");
}
function compileOperator(operator, value, docVar, context) {
  const safeCompare = (op) => {
    const valueCode = addValueAndGetCode(value, context);
    const comparison = `compareValues(${docVar}, ${valueCode})`;
    switch (op) {
      case ">":
        return `(${comparison} === 1)`;
      case "<":
        return `(${comparison} === -1)`;
      case ">=":
        return `(res => res === 1 || res === 0)(${comparison})`;
      case "<=":
        return `(res => res === -1 || res === 0)(${comparison})`;
    }
  };
  switch (operator) {
    case "$eq": {
      const valueCode = addValueAndGetCode(value, context);
      return `deepCompare(${docVar}, ${valueCode})`;
    }
    case "$gt":
      return safeCompare(">");
    case "$gte":
      return safeCompare(">=");
    case "$lt":
      return safeCompare("<");
    case "$lte":
      return safeCompare("<=");
    case "$ne": {
      const valueCode = addValueAndGetCode(value, context);
      return `!deepCompare(${docVar}, ${valueCode})`;
    }
    case "$in": {
      if (!Array.isArray(value))
        throw new QueryOperatorError("$in requires an array", "$in", value);
      const valueCode = addValueAndGetCode(value, context);
      return `(
        Array.isArray(${docVar})
          ? ${docVar}.some(fieldItem => ${valueCode}.some(queryItem => deepCompare(fieldItem, queryItem)))
          : ${valueCode}.some(queryItem => deepCompare(${docVar}, queryItem))
      )`;
    }
    case "$nin": {
      if (!Array.isArray(value))
        throw new QueryOperatorError("$nin requires an array", "$nin", value);
      const valueCode = addValueAndGetCode(value, context);
      return `!(
        Array.isArray(${docVar})
          ? ${docVar}.some(fieldItem => ${valueCode}.some(queryItem => deepCompare(fieldItem, queryItem)))
          : ${valueCode}.some(queryItem => deepCompare(${docVar}, queryItem))
      )`;
    }
    case "$not":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        if (!(value instanceof RegExp)) {
          throw new QueryOperatorError("$not requires an operator expression or a regular expression", "$not", value);
        }
      }
      return `!(${buildCodeRecursive(value, docVar, context)})`;
    case "$exists": {
      if (typeof value !== "boolean") {
        throw new QueryOperatorError("$exists requires a boolean value", "$exists", value);
      }
      return `${docVar} ${value ? "!==" : "==="} undefined`;
    }
    case "$type": {
      let expectedTypeStrings;
      if (Array.isArray(value)) {
        expectedTypeStrings = value.map((v) => String(v).toLowerCase());
      } else if (typeof value === "string") {
        expectedTypeStrings = [value.toLowerCase()];
      } else {
        throw new QueryOperatorError("$type requires a type name string or an array of type name strings", "$type", value);
      }
      const validTypes = [
        "string",
        "number",
        "boolean",
        "object",
        "array",
        "null",
        "undefined",
        "date",
        "regexp",
        "buffer"
      ];
      for (const typeStr of expectedTypeStrings) {
        if (!validTypes.includes(typeStr)) {
          throw new QueryOperatorError(`Invalid type name specified for $type: ${typeStr}`, "$type", value);
        }
      }
      const targetTypesCode = addValueAndGetCode(expectedTypeStrings, context);
      return `(actualType => actualType !== null && ${targetTypesCode}.includes(actualType))(_helpers._getJsTypeHelper(${docVar}))`;
    }
    case "$regex": {
      let pattern;
      let flags = "";
      if (typeof value === "string") {
        pattern = value;
      } else if (value instanceof RegExp) {
        pattern = value.source;
        flags = value.flags;
      } else if (typeof value === "object" && value !== null && "$regex" in value) {
        const regexObj = value;
        if (typeof regexObj.$regex !== "string") {
          throw new QueryOperatorError(`$regex: $regex requires a string, RegExp, or { $regex, $options } object`, operator, value);
        }
        pattern = regexObj.$regex;
        if (regexObj.$options !== undefined) {
          if (typeof regexObj.$options !== "string") {
            throw new QueryOperatorError(`$regex: $options requires a string`, operator, value);
          }
          flags = regexObj.$options;
        }
      } else {
        throw new QueryOperatorError(`$regex: $regex requires a string, RegExp, or { $regex, $options } object`, operator, value);
      }
      if (/[^gimsuy]/.test(flags)) {
        throw new QueryOperatorError(`$regex: Invalid regex flags specified: ${flags}`, operator, value);
      }
      const regexVar = context.getRegexVar(pattern, flags);
      return `(
        Array.isArray(${docVar})
          ? ${docVar}.some(item => typeof item === 'string' && ${regexVar} !== null && ${regexVar}.test(item))
          : (typeof ${docVar} === 'string' && ${regexVar} !== null && ${regexVar}.test(${docVar}))
      )`;
    }
    case "$mod": {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new QueryOperatorError("$mod requires an array with [ divisor, remainder ]", "$mod", value);
      }
      const [divisor, remainder] = value;
      if (typeof divisor !== "number" || typeof remainder !== "number" || !Number.isInteger(divisor) || !Number.isInteger(remainder)) {
        throw new QueryOperatorError("$mod requires divisor and remainder to be integers", "$mod", value);
      }
      if (divisor === 0) {
        throw new QueryOperatorError("$mod divisor cannot be 0", "$mod", value);
      }
      const divisorCode = addValueAndGetCode(divisor, context);
      const remainderCode = addValueAndGetCode(remainder, context);
      return `(typeof ${docVar} === 'number' && Number.isInteger(${docVar}) && ${docVar} % ${divisorCode} === ${remainderCode})`;
    }
    case "$where": {
      if (typeof value !== "string" && typeof value !== "function") {
        throw new QueryOperatorError("$where requires a string or function argument", "$where", value);
      }
      try {
        const whereOp = new WhereOperator(value);
        context.whereOperators.push(whereOp);
        return "true";
      } catch (e) {
        if (e instanceof QueryOperatorError) {
          throw e;
        } else {
          throw new QueryOperatorError(`Invalid $where argument: ${e instanceof Error ? e.message : String(e)}`, "$where", value);
        }
      }
    }
    case "$text": {
      if (typeof value !== "object" || value === null || !("$search" in value)) {
        throw new QueryOperatorError("$text requires an object with a $search property", "$text", value);
      }
      const textQuery = value;
      if (typeof textQuery.$search !== "string") {
        throw new QueryOperatorError("$text operator requires $search to be a string", "$text", value);
      }
      const searchString = textQuery.$search.trim();
      if (searchString === "") {
        throw new QueryOperatorError("$text operator $search string cannot be empty", "$text", value);
      }
      let caseSensitive = false;
      if ("$caseSensitive" in textQuery) {
        if (typeof textQuery.$caseSensitive !== "boolean") {
          throw new QueryOperatorError("$text operator $caseSensitive must be a boolean", "$text", value);
        }
        caseSensitive = textQuery.$caseSensitive;
      }
      const searchWords = searchString.split(/\s+/);
      const wordsCode = addValueAndGetCode(searchWords, context);
      const caseSensitiveCode = addValueAndGetCode(caseSensitive, context);
      return `(
                (fieldVal =>
                    typeof fieldVal === 'string' && ${wordsCode}.length > 0 && (
                        ${wordsCode}.every(word => {
                            const compareWord = ${caseSensitiveCode} ? word : word.toLowerCase();
                            const compareField = ${caseSensitiveCode} ? fieldVal : fieldVal.toLowerCase();
                            // Basic check: does the field include the word?
                            // This doesn't handle stemming, language specifics, etc.
                            return compareField.includes(compareWord);
                        })
                    )
                )(${docVar})
            )`;
    }
    case "$bitsAllSet":
    case "$bitsAnySet":
    case "$bitsAllClear":
    case "$bitsAnyClear": {
      let bitmask;
      if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
        bitmask = value;
      } else if (Array.isArray(value)) {
        bitmask = 0;
        for (const pos of value) {
          if (typeof pos !== "number" || !Number.isInteger(pos) || pos < 0) {
            throw new QueryOperatorError(`Bit positions must be non-negative integers in ${operator}`, operator, value);
          }
          bitmask |= 1 << pos;
        }
      } else {
        throw new QueryOperatorError(`${operator} requires a non-negative integer bitmask or an array of non-negative bit positions`, operator, value);
      }
      const maskCode = addValueAndGetCode(bitmask, context);
      const numCheck = `(typeof ${docVar} === 'number' && Number.isInteger(${docVar}))`;
      switch (operator) {
        case "$bitsAllSet":
          return `${numCheck} && (${docVar} & ${maskCode}) === ${maskCode}`;
        case "$bitsAnySet":
          return `${numCheck} && (${docVar} & ${maskCode}) !== 0`;
        case "$bitsAllClear":
          return `${numCheck} && (${docVar} & ${maskCode}) === 0`;
        case "$bitsAnyClear":
          return `${numCheck} && (${docVar} & ${maskCode}) !== ${maskCode}`;
      }
      break;
    }
    case "$all": {
      if (!Array.isArray(value)) {
        throw new QueryOperatorError("$all requires an array value", "$all", value);
      }
      const queryArrayCode = addValueAndGetCode(value, context);
      const check = `
                Array.isArray(${docVar}) && (
                    ${queryArrayCode}.length === 0 ||
                    ${queryArrayCode}.every(queryVal =>
                        (${docVar}).some(docItem => deepCompare(docItem, queryVal))
                    )
                )
            `;
      const nonArrayCheck = `
                !Array.isArray(${docVar}) && ${queryArrayCode}.length === 1 && deepCompare(${docVar}, ${queryArrayCode}[0])
            `;
      return `((${check.trim()}) || (${nonArrayCheck.trim()}))`;
    }
    case "$size": {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new QueryOperatorError("$size requires a non-negative integer", "$size", value);
      }
      const sizeCode = addValueAndGetCode(value, context);
      return `(Array.isArray(${docVar}) && ${docVar}.length === ${sizeCode})`;
    }
    case "$elemMatch": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new QueryOperatorError("$elemMatch requires a query object", "$elemMatch", value);
      }
      const subQueryCode = buildCodeRecursive(value, "elem", context);
      return `(
                Array.isArray(${docVar}) &&
                ${docVar}.some(elem => {
                    try {
                        return (${subQueryCode});
                    } catch (e) {
                        // Errors during sub-query execution on an element should result in false
                        // console.error("Error during $elemMatch sub-query execution:", e instanceof Error ? e.message : String(e));
                        return false;
                    }
                })
            )`;
    }
    default:
      if (isOperator(operator)) {
        console.warn(`Operator '${operator}' is recognized but not implemented in compileQuery.`);
      }
      throw new QueryOperatorError(`Unsupported operator: ${operator}`, operator, value);
  }
  return "false";
}

// src/query/query.ts
function query(obj, options = {}) {
  const { operators, interpreted = false, debug = false } = options;
  if (debug) {
    console.log(`\uD83D\uDD0D Query mode: ${interpreted ? "interpreted" : "compiled"}`);
    console.log("\uD83D\uDD0D Query object:", JSON.stringify(obj, null, 2));
  }
  if (interpreted) {
    if (debug)
      console.log("\uD83D\uDC1B Using interpreted mode for debugging");
    return build_query_new(obj, operators);
  }
  try {
    const compiledResult = compileQuery(obj, undefined);
    if (compiledResult.func) {
      if (debug) {
        console.log("⚡ Using compiled mode");
        console.log("⚡ Compiled code:", compiledResult.code);
      }
      return compiledResult.func;
    } else {
      if (debug)
        console.log("⚠️  Compilation failed, falling back to interpreted mode");
      console.warn("Query compilation failed, falling back to interpreted mode:", compiledResult.error);
      return build_query_new(obj, operators);
    }
  } catch (error) {
    if (debug)
      console.log("⚠️  Compilation error, falling back to interpreted mode:", error.message);
    console.warn("Query compilation error, falling back to interpreted mode:", error.message);
    return build_query_new(obj, operators);
  }
}
// src/query/index.ts
var allOperators = {
  ...logicalOperators,
  ...elementOperators,
  ...arrayOperators,
  ...evaluationOperators,
  ...bitwiseOperators,
  ...textSearchOperators,
  ...comparisonOperators
};
function isOperator(value) {
  return value in allOperators;
}
function createOperator(operator, value) {
  const OperatorClass = allOperators[operator];
  return new OperatorClass(value);
}

// src/iterators/last.ts
async function* last(collection2, condition) {
  const conditionFn = typeof condition === "function" ? condition : query(condition);
  for await (const current of collection2.list.backward) {
    if (conditionFn(current)) {
      yield current;
      return;
    }
  }
}

// src/iterators/first.ts
async function* first(collection2, condition) {
  const conditionFn = typeof condition === "function" ? condition : query(condition);
  for await (const current of collection2.list.forward) {
    if (conditionFn(current)) {
      yield current;
      return;
    }
  }
}

// src/iterators/all.ts
async function* all(collection2, condition) {
  const conditionFn = typeof condition === "function" ? condition : query(condition);
  for await (const current of collection2.list.forward) {
    if (conditionFn(current)) {
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
import { get as get4 } from "lodash-es";
import { BPlusTree } from "b-pl-tree";

// src/collection/ensure_indexed_value.ts
import { get, set } from "lodash-es";
function ensure_indexed_value(item, key2, collection2, gen, auto2, process) {
  let value;
  const indexDef = collection2.indexDefs[key2];
  const isCompositeIndex = !!(indexDef?.keys && indexDef.keys.length > 1);
  if (process) {
    if (isCompositeIndex) {
      value = process(item);
    } else {
      value = get(item, key2);
      if (value == null && auto2) {
        value = gen?.(item, collection2.name, collection2.list) ?? value;
        set(item, key2, value);
      }
      value = process(value);
    }
  } else {
    value = get(item, key2);
    if (value == null && auto2) {
      value = gen?.(item, collection2.name, collection2.list) ?? value;
      set(item, key2, value);
    }
  }
  return value;
}

// src/collection/get_value.ts
import { get as get2 } from "lodash-es";
function get_value(item, key2, process) {
  if (process) {
    return process(item);
  }
  return get2(item, key2);
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

// src/utils/CompositeKeyUtils.ts
import { get as get3 } from "lodash-es";

class CompositeKeyUtils {
  static DEFAULT_SEPARATOR = "\x00";
  static isCompositeIndex(indexDef) {
    return !!(indexDef.keys && indexDef.keys.length > 1);
  }
  static normalizeIndexFields(indexDef) {
    if (indexDef.key && !indexDef.keys) {
      return [{
        key: indexDef.key,
        order: indexDef.order || "asc"
      }];
    }
    if (indexDef.keys) {
      return indexDef.keys.map((keyDef) => {
        if (typeof keyDef === "string") {
          return { key: keyDef, order: "asc" };
        } else if (typeof keyDef === "object" && "key" in keyDef) {
          return { key: keyDef.key, order: keyDef.order || "asc" };
        } else {
          return { key: keyDef, order: "asc" };
        }
      });
    }
    throw new Error("Invalid index definition: must specify either key or keys");
  }
  static generateIndexName(input2) {
    if (input2.length > 0 && typeof input2[0] === "string") {
      return input2.join(",");
    }
    const fields = input2;
    if (fields.length === 1) {
      return String(fields[0].key);
    }
    return fields.map((field) => {
      const keyStr = String(field.key);
      return field.order === "desc" ? `${keyStr}:desc` : keyStr;
    }).join(",");
  }
  static createProcessFunction(fields, separator = CompositeKeyUtils.DEFAULT_SEPARATOR) {
    if (fields.length === 0) {
      return;
    }
    if (fields.length === 1) {
      const field = fields[0];
      return (item) => get3(item, field.key);
    }
    return (item) => {
      const values = fields.map((field) => get3(item, field.key));
      return CompositeKeyUtils.serialize(values, separator);
    };
  }
  static createComparator(fields, separator = CompositeKeyUtils.DEFAULT_SEPARATOR) {
    if (fields.length === 1) {
      const field = fields[0];
      if (field.order === "desc") {
        return (a, b) => {
          if (a < b)
            return 1;
          if (a > b)
            return -1;
          return 0;
        };
      }
      return;
    }
    return (a, b) => {
      const valuesA = CompositeKeyUtils.deserialize(a, separator);
      const valuesB = CompositeKeyUtils.deserialize(b, separator);
      for (let i = 0;i < Math.min(valuesA.length, valuesB.length, fields.length); i++) {
        const field = fields[i];
        const valueA = valuesA[i];
        const valueB = valuesB[i];
        if (valueA === null && valueB === null)
          continue;
        if (valueA === null)
          return field.order === "asc" ? -1 : 1;
        if (valueB === null)
          return field.order === "asc" ? 1 : -1;
        let comparison2 = 0;
        if (typeof valueA === "string" && typeof valueB === "string") {
          comparison2 = valueA.localeCompare(valueB);
        } else if (typeof valueA === "number" && typeof valueB === "number") {
          comparison2 = valueA - valueB;
        } else if (valueA instanceof Date && valueB instanceof Date) {
          comparison2 = valueA.getTime() - valueB.getTime();
        } else {
          comparison2 = String(valueA).localeCompare(String(valueB));
        }
        if (comparison2 !== 0) {
          return field.order === "desc" ? -comparison2 : comparison2;
        }
      }
      return 0;
    };
  }
  static serialize(values, separator = CompositeKeyUtils.DEFAULT_SEPARATOR) {
    return values.map((value) => {
      if (value === null || value === undefined) {
        return "";
      }
      const stringValue = String(value);
      return stringValue.replace(/\\/g, "\\\\").replace(new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `\\${separator}`);
    }).join(separator);
  }
  static deserialize(serialized, separator = CompositeKeyUtils.DEFAULT_SEPARATOR) {
    if (!serialized) {
      return [];
    }
    const parts = [];
    let current = "";
    let i = 0;
    while (i < serialized.length) {
      if (serialized[i] === "\\" && i + 1 < serialized.length) {
        current += serialized[i + 1];
        i += 2;
      } else if (serialized[i] === separator) {
        parts.push(current === "" ? null : current);
        current = "";
        i++;
      } else {
        current += serialized[i];
        i++;
      }
    }
    parts.push(current === "" ? null : current);
    return parts;
  }
  static compare(a, b) {
    if (a < b)
      return -1;
    if (a > b)
      return 1;
    return 0;
  }
  static extractValues(item, keyPaths) {
    return keyPaths.map((path) => {
      if (typeof path === "string") {
        return get3(item, path);
      }
      return get3(item, path);
    });
  }
  static createKey(item, keyPaths, separator = CompositeKeyUtils.DEFAULT_SEPARATOR) {
    const values = CompositeKeyUtils.extractValues(item, keyPaths);
    return CompositeKeyUtils.serialize(values, separator);
  }
  static validateKeyPaths(keyPaths) {
    if (!Array.isArray(keyPaths) || keyPaths.length === 0) {
      return false;
    }
    return keyPaths.every((path) => typeof path === "string" && path.length > 0);
  }
  static generateIndexNameLegacy(keyPaths) {
    return keyPaths.map((path) => String(path)).join(",");
  }
  static isEmptyValue(value) {
    return value === null || value === undefined || value === "";
  }
  static createPartialKey(values, separator = CompositeKeyUtils.DEFAULT_SEPARATOR) {
    const filteredValues = [];
    for (let i = 0;i < values.length; i++) {
      if (values[i] !== undefined) {
        filteredValues.push(values[i]);
      } else {
        break;
      }
    }
    return CompositeKeyUtils.serialize(filteredValues, separator);
  }
}

// src/collection/create_index.ts
function create_index(collection2, key2, indexDef) {
  const {
    auto: auto2 = false,
    unique: unique2 = false,
    sparse: sparse2 = false,
    required: required2 = false,
    ignoreCase: ignoreCase2,
    separator = CompositeKeyUtils.DEFAULT_SEPARATOR
  } = indexDef;
  let { gen, process } = indexDef;
  const normalizedFields = CompositeKeyUtils.normalizeIndexFields(indexDef);
  const isCompositeIndex = normalizedFields.length > 1;
  if (!key2) {
    key2 = CompositeKeyUtils.generateIndexName(normalizedFields);
  }
  if (auto2 && !gen) {
    gen = Collection.genCache["autoIncIdGen"];
  }
  if (ignoreCase2) {
    process = (value) => value?.toString ? value.toString().toLowerCase() : value;
  }
  if (!process) {
    process = CompositeKeyUtils.createProcessFunction(normalizedFields, separator);
  }
  collection2.indexDefs[key2] = {
    key: isCompositeIndex ? undefined : normalizedFields[0].key,
    keys: isCompositeIndex ? normalizedFields : undefined,
    order: !isCompositeIndex ? normalizedFields[0].order : undefined,
    separator: isCompositeIndex ? separator : undefined,
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
    const value = process ? process(item) : get4(item, key2) ?? null;
    collection2.indexes[key2].removeSpecific(value, (pointer) => key2 != collection2.id ? pointer == item[collection2.id] : true);
  } : undefined;
  const ensure = key2 !== "*" ? () => {
    if (!collection2.indexes.hasOwnProperty(key2)) {
      const comparator = CompositeKeyUtils.createComparator(normalizedFields, separator);
      collection2.indexes[key2] = new BPlusTree(undefined, unique2, comparator);
    }
  } : undefined;
  const rebuild = key2 !== "*" ? async () => {
    if (!collection2.indexes.hasOwnProperty(key2)) {
      const comparator = CompositeKeyUtils.createComparator(normalizedFields, separator);
      collection2.indexes[key2] = new BPlusTree(undefined, unique2, comparator);
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
import { get as get5, set as set2, unset, cloneDeep } from "lodash-es";

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
    const item = get5(this.hash, String(key2));
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
      const record = get5(this.hash, String(key2));
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
    const item = get5(this.hash, i?.toString() ?? "undefined");
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
      yield get5(this.hash, key2);
    }
  }
  async* toArrayReverse() {
    for (const key2 of this.keys.reverse()) {
      yield get5(this.hash, key2);
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
        try {
          const normalizedFields = CompositeKeyUtils.normalizeIndexFields(curr);
          const isCompositeIndex = normalizedFields.length > 1;
          const indexKey = CompositeKeyUtils.generateIndexName(normalizedFields);
          let separator;
          if (isCompositeIndex) {
            separator = curr.separator || CompositeKeyUtils.DEFAULT_SEPARATOR;
          }
          prev[indexKey] = {
            key: isCompositeIndex ? undefined : normalizedFields[0].key,
            keys: isCompositeIndex ? normalizedFields : undefined,
            order: !isCompositeIndex ? normalizedFields[0].order : undefined,
            separator,
            auto: curr.auto || false,
            unique: curr.unique || false,
            gen: curr.gen || (curr.auto ? Collection.genCache["autoIncIdGen"] : undefined),
            sparse: curr.sparse || false,
            required: curr.required || false,
            ignoreCase: curr.ignoreCase,
            process: curr.process
          };
        } catch (error) {
          throw new Error(`Invalid index definition: ${error.message}`);
        }
      }
      return prev;
    }, {}));
    collection.list.init(collection);
    ensure_indexes(collection);
    return collection;
  }
  static async fromList(array2, id2, root2) {
    const list2 = Collection.create({
      root: root2,
      name: "default",
      indexList: [{ key: "*" }, { key: id2, unique: true, required: true }],
      id: { name: "$order", auto: true },
      list: new List,
      adapter: new AdapterMemory
    });
    await Promise.all(array2.map((item) => list2.create(item)));
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
      const isCompositeIndex = !!(indexDef.keys && indexDef.keys.length > 1);
      if (indexDef?.process && !isCompositeIndex) {
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
      const isCompositeIndex = !!(indexDef.keys && indexDef.keys.length > 1);
      if (indexDef?.process && !isCompositeIndex) {
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
      const isCompositeIndex = !!(indexDef.keys && indexDef.keys.length > 1);
      if (indexDef?.process && !isCompositeIndex) {
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
    keys: res2.keys,
    order: res2.order,
    separator: res2.separator,
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
    keys: res.keys,
    order: res.order,
    separator: res.separator,
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

//# debugId=74F599BF2EAED78864756E2164756E21
