import { type QueryType } from './QueryType';
import type { UnaryCondition } from './UnaryCondition';
import type { ValueType } from './ValueType';
export declare function buildIt_new(obj: unknown, options?: {
    [op: string]: (...args: Array<any>) => UnaryCondition;
}): UnaryCondition;
export declare function build_query_new(input: QueryType | ValueType | unknown, options?: {
    [op: string]: (...args: Array<any>) => UnaryCondition;
}): UnaryCondition;
