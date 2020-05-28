"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const collection_1 = __importDefault(require("./collection"));
const fs_extra_1 = __importDefault(require("fs-extra"));
class CollectionFile extends collection_1.default {
    constructor(config) {
        super(config);
        this.file = config.format || `${this.model}.json`;
    }
    __restore() {
        fs_extra_1.default.ensureFileSync(this.file);
        let result = fs_extra_1.default.readFileSync(this.file);
        if (result && result.toString()) {
            return JSON.parse(result);
        }
    }
    __store(obj) {
        fs_extra_1.default.ensureFileSync(this.file);
        fs_extra_1.default.writeFileSync(this.file, JSON.stringify(obj));
    }
}
exports.default = CollectionFile;
//# sourceMappingURL=collection.node.js.map