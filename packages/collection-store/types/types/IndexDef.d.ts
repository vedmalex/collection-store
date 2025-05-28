import { IdGeneratorFunction } from './IdGeneratorFunction';
import { Item } from './Item';
import { Paths } from './Paths';
export type SortOrder = 'asc' | 'desc';
export interface IndexField<T extends Item> {
    key: string | Paths<T>;
    order?: SortOrder;
}
export interface IndexDef<T extends Item> {
    key?: string | Paths<T>;
    keys?: Array<string | Paths<T> | IndexField<T>>;
    order?: SortOrder;
    separator?: string;
    auto?: boolean;
    unique?: boolean;
    sparse?: boolean;
    required?: boolean;
    ignoreCase?: boolean;
    gen?: IdGeneratorFunction<T>;
    process?: (value: any) => any;
}
export interface SerializedIndexField {
    key: string;
    order?: SortOrder;
}
export interface SerializedIndexDef {
    key?: string;
    keys?: Array<string | SerializedIndexField>;
    order?: SortOrder;
    separator?: string;
    auto?: boolean;
    unique?: boolean;
    sparse?: boolean;
    required?: boolean;
    ignoreCase?: boolean;
    gen?: string;
    process?: string;
}
