import {
  defineConfig,
  MikroORM,
  type Options,
  type IDatabaseDriver,
} from '@mikro-orm/core'
import { CollectionStoreDriver } from './Driver'

/**
 * @inheritDoc
 */
export class CollectionStoreMikroORM extends MikroORM<CollectionStoreDriver> {
  // @ts-ignore
  private static DRIVER = CollectionStoreDriver

  /**
   * @inheritDoc
   */
  static override async init<D extends IDatabaseDriver = CollectionStoreDriver>(
    options?: Options<D>,
  ): Promise<MikroORM<D>> {
    return super.init(options)
  }

  /**
   * @inheritDoc
   */
  static override initSync<D extends IDatabaseDriver = CollectionStoreDriver>(
    options: Options<D>,
  ): MikroORM<D> {
    return super.initSync(options)
  }
}

export type CollectionStoreOptions = Options<CollectionStoreDriver>

/* istanbul ignore next */
export function defineCollectionStoreConfig(options: CollectionStoreOptions) {
  return defineConfig({ driver: CollectionStoreDriver, ...options })
}
