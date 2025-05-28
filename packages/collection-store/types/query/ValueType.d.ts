export type ValueOfType = {
    valueOf: () => number | string | boolean | bigint;
};
export type ValueType = number | string | boolean | bigint | ValueOfType;
export type Value = unknown;
export declare function isValueOfType(value: unknown): value is ValueOfType;
export declare function isValueType(value: unknown): value is ValueType;
