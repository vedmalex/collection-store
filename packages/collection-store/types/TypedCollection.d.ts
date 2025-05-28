import { Item } from './types/Item';
import { ValueType } from 'b-pl-tree';
import Collection from './collection';
import { TypedSchemaDefinition, CompleteTypedSchema, TypedQuery, TypedInsert, TypedUpdate, AtomicUpdateOperation, BulkUpdateOperation, UpdateResult, IndexOptions, SchemaValidationOptions } from './types/typed-schema';
import { ICollectionConfig } from './ICollectionConfig';
export interface TypedSchemaValidationResult<T> {
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
export interface TypedCollectionConfig<T extends Item, S extends TypedSchemaDefinition<T>> extends Omit<ICollectionConfig<T>, 'indexList'> {
    schema: S | CompleteTypedSchema<T>;
    schemaOptions?: SchemaValidationOptions;
}
export declare class TypedCollection<T extends Item, S extends TypedSchemaDefinition<T>> {
    private collection;
    private schema;
    private validator;
    private queryBuilder;
    private schemaOptions;
    constructor(config: TypedCollectionConfig<T, S>);
    find(query: TypedQuery<T, S>): Promise<T[]>;
    findFirst(query: TypedQuery<T, S>): Promise<T | undefined>;
    findLast(query: TypedQuery<T, S>): Promise<T | undefined>;
    findBy<K extends keyof S>(field: K, value: any): Promise<T[]>;
    findFirstBy<K extends keyof S>(field: K, value: any): Promise<T | undefined>;
    findLastBy<K extends keyof S>(field: K, value: any): Promise<T | undefined>;
    insert(item: TypedInsert<T, S>): Promise<T | undefined>;
    create(item: TypedInsert<T, S>): Promise<T | undefined>;
    save(item: T): Promise<T | undefined>;
    update(query: TypedQuery<T, S>, update: TypedUpdate<T, S>, merge?: boolean): Promise<T[]>;
    updateFirst(query: TypedQuery<T, S>, update: TypedUpdate<T, S>, merge?: boolean): Promise<T | undefined>;
    updateLast(query: TypedQuery<T, S>, update: TypedUpdate<T, S>, merge?: boolean): Promise<T | undefined>;
    remove(query: TypedQuery<T, S>): Promise<Array<T | undefined>>;
    removeFirst(query: TypedQuery<T, S>): Promise<T | undefined>;
    removeLast(query: TypedQuery<T, S>): Promise<T | undefined>;
    get underlying(): Collection<T>;
    validateDocument(doc: any): TypedSchemaValidationResult<T>;
    validateQuery(query: TypedQuery<T, S>): import("./query/schema-aware-query").QueryValidationResult;
    getSchema(): S;
    createIndex(name: string, field: keyof S, options?: IndexOptions): Promise<void>;
    listIndexes(name?: string): any;
    dropIndex(name: string): void;
    load(name?: string): Promise<void>;
    persist(name?: string): Promise<void>;
    reset(): Promise<void>;
    first(): Promise<T>;
    last(): Promise<T>;
    findById(id: ValueType): Promise<T | undefined>;
    updateWithId(id: ValueType, update: TypedUpdate<T, S>, merge?: boolean): Promise<T | undefined>;
    removeWithId(id: ValueType): Promise<T | undefined>;
    private convertToLegacySchema;
    private convertToIndexDef;
    updateAtomic(operation: AtomicUpdateOperation<T, S>): Promise<UpdateResult<T>>;
    updateBulk(bulkOperation: BulkUpdateOperation<T, S>): Promise<UpdateResult<T>[]>;
    private applyUpdateToDocument;
    private isDirectUpdate;
    private hasUpdateOperators;
    private applyUpdateOperators;
    private applyArrayOperators;
    private matchesCondition;
}
export declare function createTypedCollection<T extends Item, S extends TypedSchemaDefinition<T>>(config: TypedCollectionConfig<T, S>): TypedCollection<T, S>;
export declare function createSchemaCollection<T extends Item>(schema: CompleteTypedSchema<T>, config: Omit<TypedCollectionConfig<T, any>, 'schema'>): TypedCollection<T, TypedSchemaDefinition<T>>;
