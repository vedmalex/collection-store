import { SortOrder } from '../types/IndexDef';
export declare class SingleKeyUtils {
    static createComparator(order?: SortOrder): (a: any, b: any) => number;
    static validateSortOrder(order: any): order is SortOrder;
    static normalizeSortOrder(order?: SortOrder): SortOrder;
}
