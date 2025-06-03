/**
 * Phase 5.3: Offline-First Support - Sync Module
 * Day 3: Sync Management System
 *
 * ✅ IDEA: Central export point for all sync components
 * ✅ IDEA: Clean module organization and re-exports
 */

// Core Components
export { OperationQueue } from './operation-queue';
export { NetworkDetector } from './network-detector';
export { SyncManager } from './sync-manager';

// Interfaces
export type { IOperationQueue } from '../interfaces/operation-queue.interface';
export type { INetworkDetector } from '../interfaces/network-detector.interface';
export type { ISyncManager } from '../interfaces/sync-manager.interface';

// Types
export type {
  QueuedOperation,
  OperationBatch,
  QueueConfig,
  NetworkInfo,
  NetworkQuality,
  NetworkDetectionConfig,
  SyncManagerConfig,
  SyncProgress,
  SyncStats,
  SyncEvent,
  SyncStrategy,
  SyncOperationType,
  SyncOperationStatus,
  RetryStrategy
} from '../interfaces/types';

// Re-export conflict resolution types for convenience
export type {
  ConflictResolutionStrategy,
  ConflictResolution
} from '../interfaces/types';