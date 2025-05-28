import { Item } from '../types/Item';
import { Paths } from '../types/Paths';
import { IndexField } from '../types/IndexDef';
export declare class CompositeKeyUtils {
    static readonly DEFAULT_SEPARATOR = "\0";
    static isCompositeIndex<T extends Item>(indexDef: {
        key?: string | Paths<T>;
        keys?: Array<string | Paths<T> | IndexField<T>>;
    }): boolean;
    static normalizeIndexFields<T extends Item>(indexDef: {
        key?: string | Paths<T>;
        keys?: Array<string | Paths<T> | IndexField<T>>;
        order?: 'asc' | 'desc';
    }): Array<IndexField<T>>;
    static generateIndexName(keyPaths: Array<string>): string;
    static generateIndexName<T extends Item>(fields: Array<IndexField<T>>): string;
    static createProcessFunction<T extends Item>(fields: Array<IndexField<T>>, separator?: string): ((item: T) => any) | undefined;
    static createComparator<T extends Item>(fields: Array<IndexField<T>>, separator?: string): ((a: any, b: any) => number) | undefined;
    static serialize(values: any[], separator?: string): string;
    static deserialize(serialized: string, separator?: string): any[];
    static compare(a: string, b: string): number;
    static extractValues<T extends Item>(item: T, keyPaths: Array<string | Paths<T>>): any[];
    static createKey<T extends Item>(item: T, keyPaths: Array<string | Paths<T>>, separator?: string): string;
    static validateKeyPaths(keyPaths: Array<string | any>): boolean;
    static generateIndexNameLegacy(keyPaths: Array<string | any>): string;
    static isEmptyValue(value: any): boolean;
    static createPartialKey(values: any[], separator?: string): string;
}
