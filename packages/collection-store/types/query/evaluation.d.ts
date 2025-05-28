import { EvaluationOperator, QueryValue } from './types';
export declare class ModOperator implements EvaluationOperator {
    type: "evaluation";
    private divisor;
    private remainder;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class RegexOperator implements EvaluationOperator {
    type: "evaluation";
    private pattern;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class WhereOperator implements EvaluationOperator {
    type: "evaluation";
    private fn;
    constructor(value: QueryValue);
    evaluate(_value: any, context?: any): boolean;
}
export declare const evaluationOperators: {
    readonly $mod: typeof ModOperator;
    readonly $regex: typeof RegexOperator;
    readonly $where: typeof WhereOperator;
};
export declare function isEvaluationOperator(value: any): value is EvaluationOperator;
