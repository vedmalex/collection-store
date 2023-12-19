import { UnaryCondition, UnaryConditionOperation } from './UnaryCondition';
export declare function build_query(_obj: unknown, options?: {
    [op: string]: (...args: Array<any>) => UnaryCondition;
}): UnaryCondition | UnaryConditionOperation;
