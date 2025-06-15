// NEW MODULAR STRUCTURE - Recommended for all new projects

// Core Module - Main collection classes and database
export * from './core'

// Storage Module - Adapters and storage components
export * from './storage'

// Transactions Module - Transaction management
export * from './transactions'

// Query Module - Query processing and utilities
export * from './query'

// Client Module - Client-side functionality
export * from './client'

// Browser SDK Module
export * from './browser-sdk'

// Monitoring Module
export * from './monitoring'

// Types Module - Shared types and interfaces
export * from './types'

// Utils Module - Utility functions
export * from './utils'

// LEGACY COMPATIBILITY LAYER - For backward compatibility
// These imports maintain the old API structure

import AdapterFile from './storage/adapters/AdapterFile'
import Collection from './core/Collection'
import { IDataCollection } from './types/IDataCollection'
import { List } from './storage/List'
import { copy_collection } from './collection/copy_collection'
import AdapterMemory from './storage/adapters/AdapterMemory'
import { FileStorage } from './storage/FileStorage'
import type { Item } from './types/Item'

// Main TypedCollection API - recommended for all new projects
export { TypedCollection, createTypedCollection, createSchemaCollection } from './core/TypedCollection'
export type {
  TypedCollectionConfig,
  TypedSchemaValidationResult
} from './core/TypedCollection'

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
export { WALTransactionManager } from './core/wal/WALTransactionManager'
export { default as TransactionalAdapterFile } from './storage/adapters/TransactionalAdapterFile'
export { default as TransactionalAdapterMemory } from './storage/adapters/TransactionalAdapterMemory'
export type { ITransactionalStorageAdapter } from './types/ITransactionalStorageAdapter'
export type { WALTransactionOptions } from './core/wal/WALTransactionManager'

// WAL-Enhanced Collection and Database (PHASE 3)
export { WALCollection } from './core/wal/WALCollection'
export { WALDatabase } from './core/wal/WALDatabase'
export type { WALCollectionConfig } from './core/wal/WALCollection'
export type { WALDatabaseConfig } from './core/wal/WALDatabase'

// Utilities
export { copy_collection }

// Database and Transactions
export { CSDatabase } from './core/Database'
export type { CSTransaction, SavepointInfo, CSDBSavepointData, TransactionOptions } from './transactions/TransactionManager'

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
