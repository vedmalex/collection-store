/* istanbul ignore file */

// Collection Store specific exports
export * from './Connection'
export * from './Driver'
export * from './Platform'
export { CollectionStoreSchemaGenerator } from './SchemaGenerator'
export * from './types'
export * from './errors'

// Core MikroORM exports - ALL decorators, types, and utilities
export * from '@mikro-orm/core'

// Collection Store specific classes with aliases for compatibility
export { CollectionStoreEntityManager as EntityManager } from './EntityManager'
export { CollectionStoreEntityRepository as EntityRepository } from './EntityRepository'
export {
  CollectionStoreMikroORM as MikroORM,
  type CollectionStoreOptions as Options,
  defineCollectionStoreConfig as defineConfig,
} from './MikroORM'

// Additional exports for full compatibility
export { CollectionStoreEntityManager } from './EntityManager'
export { CollectionStoreEntityRepository } from './EntityRepository'
export { CollectionStoreMikroORM, type CollectionStoreOptions } from './MikroORM'
export { CollectionStoreConnection } from './Connection'
export { CollectionStoreDriver } from './Driver'
export { CollectionStorePlatform } from './Platform'
