import { BSONType, FieldTypeDefinition } from './field-types';
import { SortOrder } from './IndexDef';
import { Item } from './Item';
import { Paths } from './Paths';
export type TSTypeToBSON<T> = T extends string ? 'string' : T extends number ? 'number' | 'int' | 'double' : T extends boolean ? 'boolean' : T extends Date ? 'date' : T extends Array<any> ? 'array' : T extends object ? 'object' : T extends null ? 'null' : T extends undefined ? 'undefined' : 'object';
export type BSONToTSType<B extends BSONType> = B extends 'string' ? string : B extends 'number' | 'int' | 'double' | 'long' ? number : B extends 'boolean' ? boolean : B extends 'date' ? Date : B extends 'array' ? Array<any> : B extends 'object' ? object : B extends 'null' ? null : B extends 'undefined' ? undefined : B extends 'regex' | 'regexp' ? RegExp : B extends 'binary' | 'binData' | 'buffer' ? Buffer : B extends 'objectId' ? string : any;
export interface IndexOptions {
    order?: SortOrder;
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    partialFilterExpression?: any;
    expireAfterSeconds?: number;
    name?: string;
}
export interface TypedFieldDefinition<T = any> extends Omit<FieldTypeDefinition, 'type'> {
    type?: BSONType | BSONType[] | TSTypeToBSON<T>;
    required?: boolean;
    default?: T;
    coerce?: boolean;
    validator?: (value: T) => boolean;
    index?: boolean | IndexOptions;
    unique?: boolean;
    sparse?: boolean;
    description?: string;
    examples?: T[];
    deprecated?: boolean;
}
export type TypedSchemaDefinition<T extends Item> = {
    [K in keyof T]?: TypedFieldDefinition<T[K]>;
} & {
    [path: string]: TypedFieldDefinition<any>;
};
export interface TypedCompositeIndex<T extends Item> {
    name: string;
    fields: Array<{
        field: keyof T | Paths<T> | string;
        order?: SortOrder;
    }>;
    options?: Omit<IndexOptions, 'order'>;
}
export interface CompleteTypedSchema<T extends Item> {
    fields: TypedSchemaDefinition<T>;
    indexes?: TypedCompositeIndex<T>[];
    options?: {
        strict?: boolean;
        validateOnInsert?: boolean;
        validateOnUpdate?: boolean;
        coerceTypes?: boolean;
    };
}
export type TypedQueryValue<T> = T | {
    $eq?: T;
} | {
    $ne?: T;
} | {
    $gt?: T;
} | {
    $gte?: T;
} | {
    $lt?: T;
} | {
    $lte?: T;
} | {
    $in?: T[];
} | {
    $nin?: T[];
} | {
    $exists?: boolean;
} | {
    $type?: BSONType;
} | (T extends string ? {
    $regex?: string | RegExp;
    $options?: string;
} : {}) | (T extends number ? {
    $mod?: [number, number];
    $bitsAllSet?: number;
    $bitsAnySet?: number;
} : {}) | (T extends Array<any> ? {
    $all?: T;
    $elemMatch?: any;
    $size?: number;
} : {});
export type TypedQuery<T extends Item, S extends TypedSchemaDefinition<T>> = {
    [K in keyof S]?: S[K] extends TypedFieldDefinition<infer U> ? TypedQueryValue<U> : any;
} & {
    [path: string]: any;
    $and?: TypedQuery<T, S>[];
    $or?: TypedQuery<T, S>[];
    $nor?: TypedQuery<T, S>[];
    $not?: TypedQuery<T, S>;
};
export type TypedInsert<T extends Item, S extends TypedSchemaDefinition<T>> = {
    [K in keyof T]: S[K] extends TypedFieldDefinition<infer U> ? S[K] extends {
        required: true;
    } ? U : S[K] extends {
        default: infer D;
    } ? U | undefined : U | undefined : T[K];
};
export type TypedUpdateOperators<T extends Item, S extends TypedSchemaDefinition<T>> = {
    $set?: Partial<T>;
    $unset?: {
        [K in keyof T]?: boolean | 1;
    };
    $inc?: {
        [K in keyof T]?: T[K] extends number ? number : never;
    };
    $mul?: {
        [K in keyof T]?: T[K] extends number ? number : never;
    };
    $min?: Partial<T>;
    $max?: Partial<T>;
    $currentDate?: {
        [K in keyof T]?: T[K] extends Date ? boolean | {
            $type: 'date' | 'timestamp';
        } : never;
    };
    $addToSet?: {
        [K in keyof T]?: T[K] extends Array<infer V> ? V | {
            $each: V[];
        } : never;
    };
    $push?: {
        [K in keyof T]?: T[K] extends Array<infer V> ? V | {
            $each: V[];
            $position?: number;
            $slice?: number;
            $sort?: 1 | -1 | Record<string, 1 | -1>;
        } : never;
    };
    $pull?: {
        [K in keyof T]?: T[K] extends Array<infer V> ? V | Partial<V> | TypedQuery<V, any> : never;
    };
    $pullAll?: {
        [K in keyof T]?: T[K] extends Array<infer V> ? V[] : never;
    };
    $pop?: {
        [K in keyof T]?: T[K] extends Array<any> ? 1 | -1 : never;
    };
    $rename?: {
        [K in keyof T]?: string;
    };
};
export type TypedUpdate<T extends Item, S extends TypedSchemaDefinition<T>> = Partial<T> | TypedUpdateOperators<T, S> | (Partial<T> & TypedUpdateOperators<T, S>);
export type AtomicUpdateOperation<T extends Item, S extends TypedSchemaDefinition<T>> = {
    filter: TypedQuery<T, S>;
    update: TypedUpdate<T, S>;
    options?: {
        upsert?: boolean;
        multi?: boolean;
        merge?: boolean;
        validateSchema?: boolean;
    };
};
export type BulkUpdateOperation<T extends Item, S extends TypedSchemaDefinition<T>> = {
    operations: AtomicUpdateOperation<T, S>[];
    options?: {
        ordered?: boolean;
        validateAll?: boolean;
    };
};
export type UpdateResult<T extends Item> = {
    matchedCount: number;
    modifiedCount: number;
    upsertedCount: number;
    upsertedIds: Array<T[keyof T]>;
    modifiedDocuments: T[];
};
export type ValidFieldPath<T> = {
    [K in keyof T]: K extends string ? T[K] extends object ? K | `${K}.${ValidFieldPath<T[K]> extends string ? ValidFieldPath<T[K]> : never}` : K : never;
}[keyof T];
export type NestedFieldUpdate<T extends Item> = {
    [K in string]?: any;
};
export type InferSchemaType<S extends TypedSchemaDefinition<any>> = {
    [K in keyof S]: S[K] extends TypedFieldDefinition<infer T> ? T : any;
};
export type InferRequiredFields<S extends TypedSchemaDefinition<any>> = {
    [K in keyof S]: S[K] extends {
        required: true;
    } ? K : never;
}[keyof S];
export type InferOptionalFields<S extends TypedSchemaDefinition<any>> = {
    [K in keyof S]: S[K] extends {
        required: true;
    } ? never : K;
}[keyof S];
export interface SchemaValidationOptions {
    strict?: boolean;
    coerceTypes?: boolean;
    validateRequired?: boolean;
    allowUnknownFields?: boolean;
}
export interface SchemaValidationResult<T> {
    valid: boolean;
    data?: T;
    errors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    warnings: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
}
export declare function extractIndexesFromSchema<T extends Item>(schema: TypedSchemaDefinition<T>): Array<{
    field: string;
    options: IndexOptions;
}>;
export declare function inferTypedSchemaFromData<T extends Item>(data: T[], options?: {
    includeIndexes?: boolean;
    inferRequired?: boolean;
    sampleSize?: number;
}): TypedSchemaDefinition<T>;
