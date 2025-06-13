/**
 * Phase 5.3: Offline-First Support - Offline Manager Interface
 */

import {
  OfflineConfig,
  OfflineEvent,
  OfflineEventType,
  NetworkInfo,
  StorageStats,
  SyncStats
} from './types';

/**
 * Main interface for offline mode management
 *
 * ✅ IDEA: Central offline mode management with event system
 * ✅ IDEA: Network status detection and monitoring
 * ✅ IDEA: Configuration management for offline behavior
 */
export interface IOfflineManager {
  /**
   * Initialize the offline manager
   */
  initialize(config?: Partial<OfflineConfig>): Promise<void>;

  /**
   * Shutdown the offline manager
   */
  shutdown(): Promise<void>;

  /**
   * Check if offline mode is enabled
   */
  isOfflineMode(): boolean;

  /**
   * Enable offline mode
   */
  enableOfflineMode(): Promise<void>;

  /**
   * Disable offline mode
   */
  disableOfflineMode(): Promise<void>;

  /**
   * Get current network information
   */
  getNetworkInfo(): NetworkInfo;

  /**
   * Get current configuration
   */
  getConfig(): OfflineConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OfflineConfig>): Promise<void>;

  /**
   * Get storage statistics
   */
  getStorageStats(): Promise<StorageStats>;

  /**
   * Get sync statistics
   */
  getSyncStats(): Promise<SyncStats>;

  /**
   * Clear all offline data
   */
  clearOfflineData(): Promise<void>;

  /**
   * Force sync all pending operations
   */
  forcSync(): Promise<void>;

  /**
   * Add event listener
   */
  addEventListener(type: OfflineEventType, listener: (event: OfflineEvent) => void): void;

  /**
   * Remove event listener
   */
  removeEventListener(type: OfflineEventType, listener: (event: OfflineEvent) => void): void;

  /**
   * Emit event
   */
  emit(event: OfflineEvent): void;
}