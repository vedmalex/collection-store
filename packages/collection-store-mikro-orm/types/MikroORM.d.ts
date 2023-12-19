import { MikroORM, type Options, type IDatabaseDriver } from '@mikro-orm/core';
import { CollectionStoreDriver } from './Driver';
export declare class CollectionStoreMikroORM extends MikroORM<CollectionStoreDriver> {
    private static DRIVER;
    static init<D extends IDatabaseDriver = CollectionStoreDriver>(options?: Options<D>): Promise<MikroORM<D>>;
    static initSync<D extends IDatabaseDriver = CollectionStoreDriver>(options: Options<D>): MikroORM<D>;
}
export type CollectionStoreOptions = Options<CollectionStoreDriver>;
export declare function defineCollectionStoreConfig(options: CollectionStoreOptions): Options<CollectionStoreDriver>;
