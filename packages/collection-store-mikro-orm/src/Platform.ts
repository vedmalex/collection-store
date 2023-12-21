import {
  EntityCaseNamingStrategy,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
  NamingStrategy,
  Platform,
} from '@mikro-orm/core'
import { CollectionStoreSchemaGenerator } from './SchemaGenerator'

export class CollectionStorePlatform extends Platform {
  /* istanbul ignore next: kept for type inference only */
  override getSchemaGenerator(
    driver: IDatabaseDriver,
    em?: EntityManager,
  ): CollectionStoreSchemaGenerator {
    return new CollectionStoreSchemaGenerator(em ?? (driver as any))
  }
  /** @inheritDoc */
  override lookupExtensions(orm: MikroORM): void {
    CollectionStoreSchemaGenerator.register(orm)
  }

  override supportsTransactions(): boolean {
    return true
  }

  override getNamingStrategy(): { new (): NamingStrategy } {
    return EntityCaseNamingStrategy
  }
}
