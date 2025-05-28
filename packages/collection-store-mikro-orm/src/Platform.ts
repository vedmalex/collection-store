import {
  EntityCaseNamingStrategy,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
  NamingStrategy,
  Platform,
  IPrimaryKey,
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

  supportsSavePoints(): boolean {
    return true
  }

  override getNamingStrategy(): { new (): NamingStrategy } {
    return EntityCaseNamingStrategy
  }

  getIdentifierQuoteCharacter(): string {
    return ''
  }

  getParameterPlaceholder(index?: number): string {
    return '?'
  }

  override usesReturningStatement(): boolean {
    return false
  }

  override usesPivotTable(): boolean {
    return false
  }

  override normalizePrimaryKey<T = number | string>(data: IPrimaryKey): T {
    return data as T
  }

  override denormalizePrimaryKey(data: IPrimaryKey): IPrimaryKey {
    return data
  }

  override getSerializedPrimaryKeyField(field: string): string {
    return field
  }
}
