import { EntityManager, IDatabaseDriver, MikroORM, NamingStrategy, Platform, IPrimaryKey } from '@mikro-orm/core';
import { CollectionStoreSchemaGenerator } from './SchemaGenerator';
export declare class CollectionStorePlatform extends Platform {
    getSchemaGenerator(driver: IDatabaseDriver, em?: EntityManager): CollectionStoreSchemaGenerator;
    lookupExtensions(orm: MikroORM): void;
    supportsTransactions(): boolean;
    supportsSavePoints(): boolean;
    getNamingStrategy(): {
        new (): NamingStrategy;
    };
    getIdentifierQuoteCharacter(): string;
    getParameterPlaceholder(index?: number): string;
    usesReturningStatement(): boolean;
    usesPivotTable(): boolean;
    normalizePrimaryKey<T = number | string>(data: IPrimaryKey): T;
    denormalizePrimaryKey(data: IPrimaryKey): IPrimaryKey;
    getSerializedPrimaryKeyField(field: string): string;
}
