// Core Collection Classes
export { default as Collection } from './Collection'
export { CSDatabase } from './Database'
export { TypedCollection, createTypedCollection, createSchemaCollection } from './TypedCollection'
export { IndexManager } from './IndexManager'

// WAL (Write-Ahead Logging) Components
export { WALCollection } from './wal/WALCollection'
export { WALDatabase } from './wal/WALDatabase'
export { WALTransactionManager } from './wal/WALTransactionManager'

// Re-export types for convenience
export type {
  TypedCollectionConfig,
  TypedSchemaValidationResult
} from './TypedCollection'

export type {
  WALCollectionConfig
} from './wal/WALCollection'

export type {
  WALDatabaseConfig
} from './wal/WALDatabase'

export type {
  WALTransactionOptions
} from './wal/WALTransactionManager'