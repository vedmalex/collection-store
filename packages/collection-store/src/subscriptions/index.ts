/**
 * Real-time Subscription System
 * Phase 3: Real-time Subscriptions & Notifications
 *
 * Main entry point for the subscription system
 */

// Core engine and components
export { SubscriptionEngine } from './core/SubscriptionEngine'
export { QueryParser } from './core/QueryParser'
export { DataFilter } from './core/DataFilter'
export { ConnectionManager } from './connections/ConnectionManager'
export { NotificationManager } from './notifications/NotificationManager'
export { AuthenticationManager } from './auth/AuthenticationManager'

// Cross-tab synchronization and client-side management (Priority 2 & 4 fixes)
export { CrossTabSynchronizer } from './sync/CrossTabSynchronizer'
export { ClientSubscriptionManager } from './client/ClientSubscriptionManager'

// Interfaces and types
export * from './interfaces'

// Re-export commonly used types for convenience
export type {
  Subscription,
  SubscriptionQuery,
  SubscriptionContext,
  DataChange,
  Connection,
  SubscriptionStats,
  SubscriptionConfig,
  SubscriptionError,
  QueryParseError,
  ConnectionError,
  // New types for gap fixes
  StreamOptions,
  ChunkData,
  StreamingSession,
  DataUpdate,
  CrossTabMessage,
  TabInfo,
  ICrossTabSynchronizer,
  IClientDataManager,
  ClientDataCache,
  SyncStatus,
  ConflictResolution
} from './interfaces/types'

export type {
  ISubscriptionEngine,
  EngineHealth,
  EngineMetrics
} from './interfaces/ISubscriptionEngine'