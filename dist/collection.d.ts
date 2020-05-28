export declare function autoIncIdGen<T>(item: T, model: string, list: List<T>): string;
export declare function autoTimestamp<T>(item: T, model: string, list: List<T>): string;
export interface StoredList<T> {
    hash: {
        [key: string]: T;
    };
    _counter: number;
    _count: number;
}
export declare class List<T> implements StoredList<T> {
    hash: {
        [key: string]: T;
    };
    _counter: number;
    _count: number;
    constructor(stored?: StoredList<T>);
    get(key: any): T;
    get counter(): number;
    get length(): number;
    set length(len: number);
    push(...items: any[]): number;
    remove(i: any): T;
    reset(): void;
    [Symbol.iterator](): Generator<string, void, undefined>;
    get keys(): string[];
    load(obj: StoredList<T>): List<T>;
    persist(): StoredList<T>;
}
export interface IndexDef {
    key: string;
    auto?: boolean;
    unique?: boolean;
    sparse?: boolean;
    required?: boolean;
    gen?: string;
}
export interface Item {
    __ttltime?: number;
    id?: number;
}
export interface StoredData<T extends Item> {
    list: StoredList<T>;
    indexes: {
        [index: string]: {
            [key: string]: number | Array<number>;
        };
    };
    indexDefs: {
        [name: string]: IndexDef;
    };
    id: string;
    ttl?: number;
}
export declare type IdGeneratorFunction<T extends Item> = (item: T, model: string, list: List<T>) => string;
export interface IdType<T extends Item> {
    name: string;
    auto: boolean;
    gen: IdGeneratorFunction<T> | string;
}
export interface CollectionConfig<T extends Item> {
    ttl: string | number | boolean;
    name: string;
    id: string | Partial<IdType<T>>;
    idGen: string | IdGeneratorFunction<T>;
    auto: boolean;
    indexList: Array<IndexDef>;
}
export default class CollectionBase<T extends Item> {
    ttl: number;
    model: string;
    id: string;
    auto: boolean;
    indexes: {
        [index: string]: {
            [key: string]: number | object | Array<number>;
        };
    };
    list: List<T>;
    inserts: Array<(item: T) => (i: number) => void>;
    updates: Array<(ov: T, nv: T, i: any) => void>;
    removes: Array<(item: T, i: any) => void>;
    ensures: Array<() => void>;
    indexDefs: {
        [name: string]: IndexDef;
    };
    genCache: {
        [key: string]: IdGeneratorFunction<T>;
    };
    constructor(config?: Partial<CollectionConfig<T>>);
    reset(): void;
    __restore(): StoredData<T>;
    __store(obj: any): void;
    load(): void;
    ensureTTL(): void;
    persist(): void;
    restoreIndex(): void;
    _buildIndex(indexList: any): void;
    ensureIndexes(): void;
    prepareIndexInsert(val: any): (i: any) => void;
    updateIndex(ov: any, nv: any, i: any): void;
    removeIndex(val: any, i: any): void;
    push(item: any): void;
    _traverse(condition: any, action: any): void;
    create(item: any): T;
    findById(id: any): T;
    findBy(key: any, id: any): T[];
    find(condition: any): any[];
    findOne(condition: any): any;
    update(condition: any, update: any): void;
    updateOne(condition: any, update: any): void;
    updateWithId(id: any, update: any): void;
    removeWithId(id: any): void;
    remove(condition: any): void;
    removeOne(condition: any): void;
}
//# sourceMappingURL=collection.d.ts.map