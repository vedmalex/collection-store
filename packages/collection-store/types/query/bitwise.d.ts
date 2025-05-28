import { BitwiseOperator, QueryValue } from './types';
export declare class BitsAllSetOperator implements BitwiseOperator {
    type: "bitwise";
    private bitmask;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class BitsAnySetOperator implements BitwiseOperator {
    type: "bitwise";
    private bitmask;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class BitsAllClearOperator implements BitwiseOperator {
    type: "bitwise";
    private bitmask;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare class BitsAnyClearOperator implements BitwiseOperator {
    type: "bitwise";
    private bitmask;
    constructor(value: QueryValue);
    evaluate(value: any): boolean;
}
export declare const bitwiseOperators: {
    readonly $bitsAllSet: typeof BitsAllSetOperator;
    readonly $bitsAnySet: typeof BitsAnySetOperator;
    readonly $bitsAllClear: typeof BitsAllClearOperator;
    readonly $bitsAnyClear: typeof BitsAnyClearOperator;
};
export declare function isBitwiseOperator(value: any): value is BitwiseOperator;
