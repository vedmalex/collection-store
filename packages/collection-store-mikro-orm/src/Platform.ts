import {
  EntityCaseNamingStrategy,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
  NamingStrategy,
  Platform,
} from '@mikro-orm/core'
import { CollectionStoreSchemaGenerator } from './SchemaGenerator'

import { debug } from 'debug'
const log = debug('platform')

export class CollectionStorePlatform extends Platform {
  /* istanbul ignore next: kept for type inference only */
  override getSchemaGenerator(
    driver: IDatabaseDriver,
    em?: EntityManager,
  ): CollectionStoreSchemaGenerator {
    log('getSchemaGenerator', arguments)
    return new CollectionStoreSchemaGenerator(em ?? (driver as any))
  }
  /** @inheritDoc */
  override lookupExtensions(orm: MikroORM): void {
    log('lookupExtensions', arguments)
    CollectionStoreSchemaGenerator.register(orm)
  }

  override supportsTransactions(): boolean {
    log('supportsTransactions', arguments)
    return true
  }

  override getNamingStrategy(): { new (): NamingStrategy } {
    log('getNamingStrategy', arguments)
    return EntityCaseNamingStrategy
  }
}
