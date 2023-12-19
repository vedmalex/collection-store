import { EntityManager, IDatabaseDriver, MikroORM, NamingStrategy, Platform } from '@mikro-orm/core';
import { CollectionStoreSchemaGenerator } from './SchemaGenerator';
export declare class CollectionStorePlatform extends Platform {
    getSchemaGenerator(driver: IDatabaseDriver, em?: EntityManager): CollectionStoreSchemaGenerator;
    lookupExtensions(orm: MikroORM): void;
    supportsTransactions(): boolean;
    getNamingStrategy(): {
        new (): NamingStrategy;
    };
}
