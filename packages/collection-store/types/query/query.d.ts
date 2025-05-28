import type { QueryType } from './QueryType';
import type { UnaryCondition } from './UnaryCondition';
export interface QueryOptions {
    operators?: {
        [op: string]: (...args: Array<any>) => UnaryCondition;
    };
    interpreted?: boolean;
    debug?: boolean;
    $and?: (...args: Array<any>) => UnaryCondition;
    $or?: (...args: Array<any>) => UnaryCondition;
}
export declare function query(obj: QueryType, options?: QueryOptions): UnaryCondition;
export { build_query_new as buildQuery } from './build_query';
export { compileQuery } from './compile_query';
export declare function queryInterpreted(obj: QueryType, options?: {
    [op: string]: (...args: Array<any>) => UnaryCondition;
}): UnaryCondition;
export declare function queryCompiled(obj: QueryType, options?: {
    [op: string]: (...args: Array<any>) => string;
}): UnaryCondition;
