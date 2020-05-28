"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const collection_1 = __importDefault(require("./collection"));
class CollectionWeb extends collection_1.default {
    constructor(config) {
        super(config);
        this.storage = config.storage || localStorage;
    }
    __restore() {
        return JSON.parse(this.storage.getItem(this.model));
    }
    __store(obj) {
        this.storage.setItem(this.model, JSON.stringify(obj));
    }
}
exports.default = CollectionWeb;
//# sourceMappingURL=collection.web.js.map