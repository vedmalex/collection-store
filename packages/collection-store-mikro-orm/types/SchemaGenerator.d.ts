import { AbstractSchemaGenerator, type MikroORM } from '@mikro-orm/core';
import type { CollectionStoreDriver } from './Driver';
export declare class CollectionStoreSchemaGenerator extends AbstractSchemaGenerator<CollectionStoreDriver> {
    static register(orm: MikroORM): void;
    createSchema(options?: CreateSchemaOptions): Promise<void>;
    dropSchema(options?: {
        dropMigrationsTable?: boolean;
    }): Promise<void>;
    updateSchema(options?: CreateSchemaOptions): Promise<void>;
    ensureDatabase(): Promise<boolean>;
    refreshDatabase(options?: CreateSchemaOptions): Promise<void>;
    ensureIndexes(options?: EnsureIndexesOptions): Promise<void>;
    private createIndexes;
    private createUniqueIndexes;
    private createPropertyIndexes;
    private createAutoIndexes;
}
export interface CreateSchemaOptions {
    ensureIndexes?: boolean;
    wrap?: boolean;
    schema?: string;
}
export interface EnsureIndexesOptions {
    ensureCollections?: boolean;
    retry?: boolean | string[];
    retryLimit?: number;
}
