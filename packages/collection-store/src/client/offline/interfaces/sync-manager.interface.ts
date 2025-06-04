/**
 * Phase 5.3: Offline-First Support - Sync Manager Interface
 */

import {
  OfflineOperation,
  SyncConfig,
  SyncStats,
  SyncPriority,
  NetworkInfo,
  SyncProgress,
  SyncEvent,
  SyncEventType,
  QueuedOperation,
  OperationBatch,
  SyncManagerConfig,
  SyncStrategy
} from './types';
import { IOperationQueue } from './operation-queue.interface';
import { INetworkDetector } from './network-detector.interface';
import { IConflictResolver } from './conflict-resolver.interface';

/**
 * Interface for sync management
 * Orchestrates synchronization between local and remote data stores
 */
export interface ISyncManager {
  /**
   * Initialize the sync manager
   */
  initialize(config: SyncManagerConfig): Promise<void>;

  /**
   * Set dependencies
   */
  setDependencies(
    operationQueue: IOperationQueue,
    networkDetector: INetworkDetector,
    conflictResolver: IConflictResolver
  ): void;

  /**
   * Start sync manager
   */
  start(): Promise<void>;

  /**
   * Stop sync manager
   */
  stop(): Promise<void>;

  /**
   * Queue an operation for sync
   */
  queueOperation(operation: QueuedOperation): Promise<void>;

  /**
   * Start immediate sync
   */
  startSync(): Promise<void>;

  /**
   * Cancel ongoing sync
   */
  cancelSync(): Promise<void>;

  /**
   * Pause sync operations
   */
  pauseSync(): Promise<void>;

  /**
   * Resume sync operations
   */
  resumeSync(): Promise<void>;

  /**
   * Force sync regardless of network conditions
   */
  forceSync(): Promise<void>;

  /**
   * Sync specific collection
   */
  syncCollection(collection: string): Promise<void>;

  /**
   * Sync specific operation
   */
  syncOperation(operationId: string): Promise<void>;

  /**
   * Get sync status
   */
  getSyncStatus(): Promise<{
    isActive: boolean;
    isPaused: boolean;
    currentOperation?: string;
    progress?: SyncProgress;
    lastSync?: number;
    nextSync?: number;
  }>;

  /**
   * Get sync statistics
   */
  getStats(): Promise<SyncStats>;

  /**
   * Get sync progress
   */
  getProgress(): Promise<SyncProgress | null>;

  /**
   * Add event listener
   */
  addEventListener(event: SyncEventType, callback: (event: SyncEvent) => void): void;

  /**
   * Remove event listener
   */
  removeEventListener(event: SyncEventType, callback: (event: SyncEvent) => void): void;

  /**
   * Update sync configuration
   */
  updateConfig(config: Partial<SyncConfig>): Promise<void>;

  /**
   * Get current configuration
   */
  getConfig(): Promise<SyncConfig>;

  /**
   * Clear sync queue
   */
  clearQueue(): Promise<void>;

  /**
   * Retry failed operations
   */
  retryFailedOperations(): Promise<number>;

  /**
   * Get failed operations
   */
  getFailedOperations(): Promise<QueuedOperation[]>;

  /**
   * Get pending operations count
   */
  getPendingOperationsCount(): Promise<number>;

  /**
   * Estimate sync time
   */
  estimateSyncTime(): Promise<number>;

  /**
   * Check if sync is needed
   */
  isSyncNeeded(): Promise<boolean>;

  /**
   * Get last sync time
   */
  getLastSyncTime(): Promise<number>;

  /**
   * Set sync strategy
   */
  setSyncStrategy(strategy: SyncStrategy): Promise<void>;

  /**
   * Get recommended sync strategy based on current conditions
   */
  getRecommendedStrategy(): Promise<SyncStrategy>;

  /**
   * Process operation batch
   */
  processBatch(batch: OperationBatch): Promise<void>;

  /**
   * Create and process batch from pending operations
   */
  createAndProcessBatch(maxOperations?: number): Promise<OperationBatch | null>;

  /**
   * Handle network change
   */
  handleNetworkChange(networkInfo: NetworkInfo): Promise<void>;

  /**
   * Optimize sync performance
   */
  optimizePerformance(): Promise<void>;

  /**
   * Export sync data for backup
   */
  export(): Promise<{
    config: SyncConfig;
    stats: SyncStats;
    pendingOperations: QueuedOperation[];
    metadata: {
      exportTime: number;
      version: string;
    };
  }>;

  /**
   * Import sync data from backup
   */
  import(data: {
    config?: SyncConfig;
    pendingOperations?: QueuedOperation[];
  }): Promise<void>;

  /**
   * Health check for sync manager
   */
  healthCheck(): Promise<{
    isHealthy: boolean;
    issues: string[];
    performance: {
      averageOperationTime: number;
      successRate: number;
      queueSize: number;
    };
  }>;
}