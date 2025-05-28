import { LogicalOperator, QueryValue } from './types';
export declare class AndOperator implements LogicalOperator {
    type: "logical";
    private conditions;
    constructor(conditions: QueryValue[]);
    evaluate(value: any, context?: any): boolean;
}
export declare class OrOperator implements LogicalOperator {
    type: "logical";
    private conditions;
    constructor(conditions: QueryValue[]);
    evaluate(value: any, context?: any): boolean;
}
export declare class NotOperator implements LogicalOperator {
    type: "logical";
    private condition;
    constructor(condition: QueryValue);
    evaluate(value: any, context?: any): boolean;
}
export declare class NorOperator implements LogicalOperator {
    type: "logical";
    private conditions;
    constructor(conditions: QueryValue[]);
    evaluate(value: any, context?: any): boolean;
}
export declare const logicalOperators: {
    readonly $and: typeof AndOperator;
    readonly $or: typeof OrOperator;
    readonly $not: typeof NotOperator;
    readonly $nor: typeof NorOperator;
};
export declare function isLogicalOperator(value: any): value is LogicalOperator;
