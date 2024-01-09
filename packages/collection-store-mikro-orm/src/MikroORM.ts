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

/* istanbul ignore next */
export function defineCollectionStoreConfig(options: CollectionStoreOptions) {
  return defineConfig({ driver: CollectionStoreDriver, ...options })
}
