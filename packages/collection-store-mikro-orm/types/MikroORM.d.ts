import { MikroORM, type Options, type IDatabaseDriver, EntityManagerType, EntityManager } from '@mikro-orm/core';
import { CollectionStoreDriver } from './Driver';
import { CollectionStoreEntityManager } from './EntityManager';
export declare class CollectionStoreMikroORM<EM extends EntityManager = CollectionStoreEntityManager> extends MikroORM<CollectionStoreDriver, EM> {
    private static DRIVER;
    static init<D extends IDatabaseDriver = CollectionStoreDriver, EM extends EntityManager = D[typeof EntityManagerType] & EntityManager>(options?: Options<D, EM>): Promise<MikroORM<D, EM>>;
    static initSync<D extends IDatabaseDriver = CollectionStoreDriver, EM extends EntityManager = D[typeof EntityManagerType] & EntityManager>(options: Options<D, EM>): MikroORM<D, EM>;
}
export type CollectionStoreOptions = Options<CollectionStoreDriver>;
export declare function defineCollectionStoreConfig(options?: Partial<CollectionStoreOptions>): Options<CollectionStoreDriver, CollectionStoreEntityManager<CollectionStoreDriver> & EntityManager<IDatabaseDriver<import("@mikro-orm/core").Connection>>>;
