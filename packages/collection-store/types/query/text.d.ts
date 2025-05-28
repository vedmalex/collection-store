import { TextSearchOperatorType as TextSearchOperator, QueryValue } from './types';
export declare class TextSearchOperatorImpl implements TextSearchOperator {
    type: "text";
    private searchTerms;
    private caseSensitive;
    private diacriticSensitive;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
    private removeDiacritics;
}
export declare const textSearchOperators: {
    readonly $text: typeof TextSearchOperatorImpl;
};
export declare function isTextSearchOperator(value: any): value is TextSearchOperator;
