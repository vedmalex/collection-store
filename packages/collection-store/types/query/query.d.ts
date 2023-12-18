import { UnaryCondition } from './UnaryCondition';
export declare function query(obj: unknown, options?: {
    [op: string]: (...args: Array<any>) => UnaryCondition;
}): UnaryCondition;
