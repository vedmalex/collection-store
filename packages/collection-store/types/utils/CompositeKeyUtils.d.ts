import { Item } from '../types/Item';
import { Paths } from '../types/Paths';
import { CompositeKeyField } from '../types/IndexDef';
export declare class CompositeKeyUtils {
    static readonly DEFAULT_SEPARATOR = "\0";
    static serialize(values: any[], separator?: string): string;
    static deserialize(serialized: string, separator?: string): any[];
    static compare(a: string, b: string): number;
    static extractValues<T extends Item>(item: T, keyPaths: Array<string | Paths<T>>): any[];
    static createKey<T extends Item>(item: T, keyPaths: Array<string | Paths<T>>, separator?: string): string;
    static validateKeyPaths(keyPaths: Array<string | any>): boolean;
    static generateIndexName(keyPaths: Array<string | any>): string;
    static isEmptyValue(value: any): boolean;
    static createPartialKey(values: any[], separator?: string): string;
    static normalizeCompositeKeys<T extends Item>(keys: Array<string | Paths<T> | CompositeKeyField<T>>): Array<CompositeKeyField<T>>;
    static extractValuesWithOrder<T extends Item>(item: T, fields: Array<CompositeKeyField<T>>): any[];
    static createComparator<T extends Item>(fields: Array<CompositeKeyField<T>>, separator?: string): (a: string, b: string) => number;
    static createKeyWithOrder<T extends Item>(item: T, fields: Array<CompositeKeyField<T>>, separator?: string): string;
    static validateCompositeKeyFields<T extends Item>(fields: Array<CompositeKeyField<T>>): boolean;
    static generateIndexNameFromFields<T extends Item>(fields: Array<CompositeKeyField<T>>): string;
}
