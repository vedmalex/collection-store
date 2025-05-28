import { ArrayOperator, QueryValue } from './types';
import type { UnaryCondition } from '../query/UnaryCondition';
export declare class AllOperator implements ArrayOperator {
    type: "array";
    private values;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class ElemMatchOperator implements ArrayOperator {
    type: "array";
    private condition;
    constructor(condition: UnaryCondition);
    evaluate(value: any): boolean;
}
export declare class SizeOperator implements ArrayOperator {
    type: "array";
    private expectedSize;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare const arrayOperators: {
    readonly $all: typeof AllOperator;
    readonly $elemMatch: typeof ElemMatchOperator;
    readonly $size: typeof SizeOperator;
};
export declare function isArrayOperator(value: any): value is ArrayOperator;
