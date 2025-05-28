export type PrimitiveValue = string | number | bigint | boolean | null | undefined;
export type ComplexValue = Date | RegExp;
export type ArrayValue = Array<QueryValue>;
export type ObjectValue = {
    [key: string]: QueryValue;
};
export type FunctionValue = (this: any, ...args: any[]) => any;
export interface QueryOperator {
    type: string;
    evaluate(value: any, context?: any): boolean;
    [key: string]: any;
}
export type QueryValue = PrimitiveValue | ComplexValue | ArrayValue | ObjectValue | FunctionValue | QueryOperator;
export declare function isQueryOperator(value: any): value is QueryOperator;
export declare class QueryOperatorError extends Error {
    name: string;
    operator: string;
    value?: any;
    constructor(message: string, operator: string, value?: any);
}
export interface LogicalOperator extends QueryOperator {
    type: 'logical';
}
export interface ElementOperator extends QueryOperator {
    type: 'element';
}
export interface ArrayOperator extends QueryOperator {
    type: 'array';
}
export interface EvaluationOperator extends QueryOperator {
    type: 'evaluation';
}
export interface BitwiseOperator extends QueryOperator {
    type: 'bitwise';
}
export interface TextSearchOperatorType extends QueryOperator {
    type: 'text';
}
export interface ComparisonOperator extends QueryOperator {
    type: 'comparison';
}
export type OperatorConstructor<T extends QueryOperator> = new (value: QueryValue) => T;
