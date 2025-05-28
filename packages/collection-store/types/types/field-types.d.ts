export type BSONType = 'null' | 'undefined' | 'number' | 'double' | 'int' | 'long' | 'string' | 'object' | 'array' | 'boolean' | 'date' | 'regex' | 'regexp' | 'objectId' | 'binary' | 'binData' | 'buffer';
export type FieldTypeDefinition = {
    type: BSONType | BSONType[];
    required?: boolean;
    default?: any;
    coerce?: boolean;
    strict?: boolean;
    validator?: (value: any) => boolean;
    description?: string;
};
export type SchemaDefinition = {
    [fieldPath: string]: FieldTypeDefinition;
};
export declare function detectBSONType(value: unknown): BSONType;
export declare class TypeCoercion {
    static toString(value: any): string | null;
    static toNumber(value: any): number | null;
    static toBoolean(value: any): boolean | null;
    static toDate(value: any): Date | null;
    static toArray(value: any): any[] | null;
}
export declare class TypeCompatibility {
    static isCompatible(value: any, expectedTypes: BSONType | BSONType[]): boolean;
    static canCoerce(sourceType: BSONType, targetTypes: BSONType[]): boolean;
    static coerceValue(value: any, targetType: BSONType): any;
}
export declare class FieldValidator {
    private schema;
    constructor(schema: SchemaDefinition);
    validateField(fieldPath: string, value: any): {
        valid: boolean;
        coercedValue?: any;
        error?: string;
        warnings?: string[];
    };
    validateDocument(doc: any): {
        valid: boolean;
        processedDoc?: any;
        errors: string[];
        warnings: string[];
    };
    private getNestedValue;
    private setNestedValue;
}
export declare class OperatorTypeChecker {
    private static operatorTypeMap;
    static isOperatorCompatible(operator: string, fieldType: BSONType): boolean;
    static getIncompatibleOperators(fieldType: BSONType): string[];
    static validateOperatorUsage(operator: string, fieldType: BSONType, queryValue: any): {
        valid: boolean;
        error?: string;
        suggestion?: string;
    };
}
export declare function createFieldValidator(schema: SchemaDefinition): FieldValidator;
export declare function validateOperator(operator: string, fieldType: BSONType, queryValue: any): {
    valid: boolean;
    error?: string;
    suggestion?: string;
};
