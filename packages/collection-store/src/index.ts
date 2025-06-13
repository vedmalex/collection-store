import AdapterFile from './AdapterFile'
import Collection from './collection'
import { IDataCollection } from './IDataCollection'
import { List } from './storage/List'
import { copy_collection } from './collection/copy_collection'
import AdapterMemory from './AdapterMemory'
import { FileStorage } from './storage/FileStorage'
import type { Item } from './types/Item'

// Main TypedCollection API - recommended for all new projects
export { TypedCollection, createTypedCollection, createSchemaCollection } from './TypedCollection'
export type {
  TypedCollectionConfig,
  TypedSchemaValidationResult
} from './TypedCollection'

// Typed Schema System
export type {
  TypedSchemaDefinition,
  TypedFieldDefinition,
  CompleteTypedSchema,
  TypedQuery,
  TypedInsert,
  TypedUpdate,
  TypedUpdateOperators,
  AtomicUpdateOperation,
  BulkUpdateOperation,
  UpdateResult,
  IndexOptions,
  SchemaValidationOptions,
  SchemaValidationResult
} from './types/typed-schema'

// Legacy Collection API - for internal use and backward compatibility
export { Collection }

// Storage and Adapters
export { AdapterMemory }
export { AdapterFile as AdapterFile }
export { List }
export { FileStorage }

// WAL and Transactional Storage
export * from './wal'
export { WALTransactionManager } from './WALTransactionManager'
export { default as TransactionalAdapterFile } from './TransactionalAdapterFile'
export { default as TransactionalAdapterMemory } from './TransactionalAdapterMemory'
export type { ITransactionalStorageAdapter } from './ITransactionalStorageAdapter'
export type { WALTransactionOptions } from './WALTransactionManager'

// WAL-Enhanced Collection and Database (PHASE 3)
export { WALCollection } from './WALCollection'
export { WALDatabase } from './WALDatabase'
export type { WALCollectionConfig } from './WALCollection'
export type { WALDatabaseConfig } from './WALDatabase'

// Utilities
export { copy_collection }

// Database and Transactions
export { CSDatabase } from './CSDatabase'
export type { CSTransaction, SavepointInfo, CSDBSavepointData, TransactionOptions } from './TransactionManager'

// Types
export type { Item, IDataCollection }

// Field Types System (for advanced schema definitions)
export type {
  BSONType,
  FieldTypeDefinition,
  SchemaDefinition
} from './types/field-types'

// Query System
export type {
  TraverseCondition
} from './types/TraverseCondition'

// Index Types
export type {
  IndexDef,
  SortOrder
} from './types/IndexDef'

// Advanced Features - WAL Compression
export {
  WALCompression,
  createWALCompression,
  compressBatch,
  decompressBatch
} from './wal/WALCompression'
export type {
  CompressionOptions,
  CompressedWALEntry
} from './wal/WALCompression'

// Advanced Features - Performance Monitoring
export { PerformanceMonitor } from './monitoring/PerformanceMonitor'
export type {
  PerformanceMetrics,
  PerformanceAlert,
  MonitoringConfig
} from './monitoring/PerformanceMonitor'

// Offline-First Support (Phase 5.3)
export * from './client/offline'

// Offline Types
export type {
  OfflineConfig,
  CacheConfig,
  ConflictData,
  EnhancedConflictData,
  NetworkInfo,
  SyncStats,
  StorageStats,
  ConflictResolutionStrategy,
  SyncStrategy,
  NetworkQuality,
  QueuedOperation,
  OperationBatch,
  SyncProgress,
  ConflictResolution,
  IOfflineManager,
  ILocalDataCache,
  ISyncManager,
  IConflictResolver,
  INetworkDetector,
  IOperationQueue
} from './client/offline'

// Browser SDK
export * from './browser-sdk';
