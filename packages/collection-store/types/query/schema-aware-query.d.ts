import { SchemaDefinition, BSONType } from '../types/field-types';
export interface QueryValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    processedQuery?: any;
}
export interface SchemaAwareQueryOptions {
    validateTypes?: boolean;
    coerceValues?: boolean;
    strictMode?: boolean;
    allowUnknownFields?: boolean;
}
export declare class SchemaAwareQueryBuilder {
    private schema;
    private validator;
    private options;
    constructor(schema: SchemaDefinition, options?: SchemaAwareQueryOptions);
    validateQuery(query: any): QueryValidationResult;
    buildQuery(query: any, options?: {
        interpreted?: boolean;
    }): {
        queryFn: (doc: any) => boolean;
        validation: QueryValidationResult;
    };
    compileQuery(query: any): {
        compiledResult: any;
        validation: QueryValidationResult;
    };
    validateDocument(doc: any): {
        valid: boolean;
        processedDoc?: any;
        errors: string[];
        warnings: string[];
    };
    getFieldType(fieldPath: string): BSONType | BSONType[] | undefined;
    hasField(fieldPath: string): boolean;
    getSchema(): SchemaDefinition;
    private validateQueryRecursive;
    private getFieldTypeForPath;
    private validateOperatorForType;
    private validateFieldValue;
}
export declare function createSchemaAwareQuery(schema: SchemaDefinition, options?: SchemaAwareQueryOptions): SchemaAwareQueryBuilder;
export declare function inferSchemaFromData(data: any[]): SchemaDefinition;
