import {
  defineConfig,
  MikroORM,
  type Options,
  type IDatabaseDriver,
  EntityManagerType,
  EntityManager,
} from '@mikro-orm/core'
import { CollectionStoreDriver } from './Driver'
import { CollectionStoreEntityManager } from './EntityManager'

/**
 * @inheritDoc
 */
export class CollectionStoreMikroORM<
  EM extends EntityManager = CollectionStoreEntityManager,
> extends MikroORM<CollectionStoreDriver, EM> {
  // @ts-ignore
  private static DRIVER = CollectionStoreDriver

  /**
   * @inheritDoc
   */
  static override async init<
    D extends IDatabaseDriver = CollectionStoreDriver,
    EM extends EntityManager = D[typeof EntityManagerType] & EntityManager,
  >(options?: Options<D, EM>): Promise<MikroORM<D, EM>> {
    return super.init(options)
  }

  /**
   * @inheritDoc
   */
  static override initSync<
    D extends IDatabaseDriver = CollectionStoreDriver,
    EM extends EntityManager = D[typeof EntityManagerType] & EntityManager,
  >(options: Options<D, EM>): MikroORM<D, EM> {
    return super.initSync(options)
  }
}

export type CollectionStoreOptions = Options<CollectionStoreDriver>

/**
 * Helper function to define Collection Store MikroORM configuration with smart defaults
 * @param options - Configuration options
 * @returns Complete MikroORM configuration
 */
export function defineCollectionStoreConfig(options: Partial<CollectionStoreOptions> = {}) {
  const config = {
    // Collection Store driver
    driver: CollectionStoreDriver,

    // Smart defaults for Collection Store
    dbName: options.dbName || ':memory:',
    debug: options.debug ?? true,

    // Entity discovery
    entities: options.entities || [],
    entitiesTs: options.entitiesTs || ['src/**/*.entity.ts'],

    // Optimized settings for in-memory database
    cache: {
      enabled: true,
      adapter: 'memory' as const,
      ...(options as any).cache,
    },

    // Performance optimizations
    forceEntityConstructor: true,
    forceUndefined: false,

    // Development helpers
    validate: options.validate ?? true,
    strict: options.strict ?? true,

    // Override with user options
    ...options,
  }

  return defineConfig(config as Options<CollectionStoreDriver>)
}
