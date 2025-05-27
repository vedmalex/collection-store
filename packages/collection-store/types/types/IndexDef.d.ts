import { IdGeneratorFunction } from './IdGeneratorFunction';
import { Item } from './Item';
import { Paths } from './Paths';
export type SortOrder = 'asc' | 'desc';
export interface CompositeKeyField<T extends Item> {
    key: string | Paths<T>;
    order?: SortOrder;
}
export interface CompositeKeyDef<T extends Item> {
    keys: Array<string | Paths<T> | CompositeKeyField<T>>;
    separator?: string;
}
export interface IndexDef<T extends Item> {
    key?: string | Paths<T>;
    keys?: Array<string | Paths<T>>;
    composite?: CompositeKeyDef<T>;
    order?: SortOrder;
    auto?: boolean;
    unique?: boolean;
    sparse?: boolean;
    required?: boolean;
    ignoreCase?: boolean;
    gen?: IdGeneratorFunction<T>;
    process?: (value: any) => any;
}
export interface SerializedCompositeKeyField {
    key: string;
    order?: SortOrder;
}
export interface SerializedIndexDef {
    key?: string;
    keys?: Array<string>;
    composite?: {
        keys: Array<string | SerializedCompositeKeyField>;
        separator?: string;
    };
    order?: SortOrder;
    auto?: boolean;
    unique?: boolean;
    sparse?: boolean;
    required?: boolean;
    ignoreCase?: boolean;
    gen?: string;
    process?: string;
}
