import { QueryValue, ComparisonOperator } from './types';
export declare function compareBSONValues(v1: unknown, v2: unknown): number | null;
export declare function deepCompare(val1: unknown, val2: unknown): boolean;
export declare class EqOperator implements ComparisonOperator {
    type: "comparison";
    private queryValue;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class NeOperator implements ComparisonOperator {
    type: "comparison";
    private queryValue;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class GtOperator implements ComparisonOperator {
    type: "comparison";
    private queryValue;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class GteOperator implements ComparisonOperator {
    type: "comparison";
    private queryValue;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class LtOperator implements ComparisonOperator {
    type: "comparison";
    private queryValue;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class LteOperator implements ComparisonOperator {
    type: "comparison";
    private queryValue;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class InOperator implements ComparisonOperator {
    type: "comparison";
    private queryValues;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare class NinOperator implements ComparisonOperator {
    type: "comparison";
    private queryValues;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare const comparisonOperators: {
    readonly $eq: typeof EqOperator;
    readonly $ne: typeof NeOperator;
    readonly $gt: typeof GtOperator;
    readonly $gte: typeof GteOperator;
    readonly $lt: typeof LtOperator;
    readonly $lte: typeof LteOperator;
    readonly $in: typeof InOperator;
    readonly $nin: typeof NinOperator;
};
export declare function isComparisonOperator(value: any): value is ComparisonOperator;
