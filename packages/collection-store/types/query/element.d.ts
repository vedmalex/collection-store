import { ElementOperator, QueryValue } from './types';
export declare class ExistsOperator implements ElementOperator {
    type: "element";
    private shouldExist;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class TypeOperator implements ElementOperator {
    type: "element";
    private checkers;
    private static typeCheckers;
    constructor(value: QueryValue);
    evaluate(value: any, _context?: any): boolean;
}
export declare const elementOperators: {
    readonly $exists: typeof ExistsOperator;
    readonly $type: typeof TypeOperator;
};
export declare function isElementOperator(value: any): value is ElementOperator;
