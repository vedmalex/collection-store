/**
 * Phase 5.3: Offline-First Support - Offline Manager Implementation
 */

// Browser environment compatibility
import {
  IOfflineManager,
  ILocalDataCache,
  ISyncManager,
  IConflictResolver,
  OfflineConfig,
  OfflineEvent,
  OfflineEventType,
  NetworkInfo,
  StorageStats,
  SyncStats,
  NetworkStatus
} from '../interfaces';

/**
 * Main offline manager implementation
 *
 * ✅ IDEA: Central offline mode management with event system
 * ✅ IDEA: Network status detection and monitoring
 * ✅ IDEA: Configuration management for offline behavior
 */
export class OfflineManager implements IOfflineManager {
  private config: OfflineConfig;
  private isInitialized = false;
  private offlineMode = false;
  private networkInfo: NetworkInfo;
  private eventListeners: Map<OfflineEventType, Set<(event: OfflineEvent) => void>> = new Map();
  private networkMonitorInterval?: NodeJS.Timeout;

  // Dependencies (will be injected)
  private cache?: ILocalDataCache;
  private syncManager?: ISyncManager;
  private conflictResolver?: IConflictResolver;

  constructor() {
    this.config = this.getDefaultConfig();
    this.networkInfo = this.getInitialNetworkInfo();
  }

  /**
   * Initialize the offline manager
   */
  async initialize(config?: Partial<OfflineConfig>): Promise<void> {
    const startTime = performance.now();

    try {
      if (this.isInitialized) {
        throw new Error('OfflineManager already initialized');
      }

      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize network monitoring
      if (this.config.networkDetection) {
        this.startNetworkMonitoring();
      }

      // Set offline mode based on network status
      if (this.config.enabled) {
        await this.updateOfflineMode();
      }

      this.isInitialized = true;

      this.emit({
        type: 'offline-mode-changed',
        timestamp: Date.now(),
        data: { enabled: this.config.enabled, offlineMode: this.offlineMode }
      });

      const duration = performance.now() - startTime;
      console.log(`OfflineManager initialized in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to initialize OfflineManager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the offline manager
   */
  async shutdown(): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.isInitialized) {
        return;
      }

      // Stop network monitoring
      this.stopNetworkMonitoring();

      // Clear event listeners
      this.eventListeners.clear();

      this.isInitialized = false;
      this.offlineMode = false;

      const duration = performance.now() - startTime;
      console.log(`OfflineManager shutdown in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to shutdown OfflineManager:', error);
      throw error;
    }
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  /**
   * Enable offline mode
   */
  async enableOfflineMode(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineManager not initialized');
    }

    if (!this.offlineMode) {
      this.offlineMode = true;
      this.config.enabled = true;

      this.emit({
        type: 'offline-mode-changed',
        timestamp: Date.now(),
        data: { enabled: true, offlineMode: true }
      });
    }
  }

  /**
   * Disable offline mode
   */
  async disableOfflineMode(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineManager not initialized');
    }

    if (this.offlineMode) {
      this.offlineMode = false;
      this.config.enabled = false;

      this.emit({
        type: 'offline-mode-changed',
        timestamp: Date.now(),
        data: { enabled: false, offlineMode: false }
      });
    }
  }

  /**
   * Get current network information
   */
  getNetworkInfo(): NetworkInfo {
    return { ...this.networkInfo };
  }

  /**
   * Get current configuration
   */
  getConfig(): OfflineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<OfflineConfig>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineManager not initialized');
    }

    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // Handle network detection changes
    if (oldConfig.networkDetection !== this.config.networkDetection) {
      if (this.config.networkDetection) {
        this.startNetworkMonitoring();
      } else {
        this.stopNetworkMonitoring();
      }
    }

    // Handle enabled state changes
    if (oldConfig.enabled !== this.config.enabled) {
      if (this.config.enabled) {
        await this.updateOfflineMode();
      } else {
        await this.disableOfflineMode();
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    if (!this.cache) {
      return {
        totalSize: 0,
        usedSize: 0,
        availableSize: 0,
        entryCount: 0,
        collections: {}
      };
    }

    return await this.cache.getStats();
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    if (!this.syncManager) {
      return {
        pendingOperations: 0,
        syncedOperations: 0,
        failedOperations: 0,
        conflictedOperations: 0,
        lastSyncTime: 0,
        averageSyncTime: 0,
        totalSyncTime: 0
      };
    }

    return await this.syncManager.getSyncStats();
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineManager not initialized');
    }

    const startTime = performance.now();

    try {
      // Clear cache
      if (this.cache) {
        await this.cache.clear();
      }

      // Clear sync operations
      if (this.syncManager) {
        await this.syncManager.clearCompletedOperations();
      }

      // Clear conflicts
      if (this.conflictResolver) {
        await this.conflictResolver.clearResolvedConflicts();
      }

      this.emit({
        type: 'cache-cleared',
        timestamp: Date.now(),
        data: { duration: performance.now() - startTime }
      });

      const duration = performance.now() - startTime;
      console.log(`Offline data cleared in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }

  /**
   * Force sync all pending operations
   */
  async forcSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineManager not initialized');
    }

    if (!this.syncManager) {
      throw new Error('SyncManager not available');
    }

    await this.syncManager.forceSync();
  }

  /**
   * Add event listener
   */
  addEventListener(type: OfflineEventType, listener: (event: OfflineEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: OfflineEventType, listener: (event: OfflineEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(type);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event: OfflineEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Set dependencies (for dependency injection)
   */
  setDependencies(
    cache?: ILocalDataCache,
    syncManager?: ISyncManager,
    conflictResolver?: IConflictResolver
  ): void {
    this.cache = cache;
    this.syncManager = syncManager;
    this.conflictResolver = conflictResolver;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): OfflineConfig {
    return {
      enabled: true,
      maxStorageSize: 50 * 1024 * 1024, // 50MB
      maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      syncInterval: 30 * 1000, // 30 seconds
      retryInterval: 5 * 1000, // 5 seconds
      maxRetries: 3,
      conflictResolution: 'timestamp-based',
      storageOptimization: 'lru',
      networkDetection: true,
      autoSync: true,
      batchSize: 100,
      compressionEnabled: true
    };
  }

  /**
   * Get initial network information
   */
  private getInitialNetworkInfo(): NetworkInfo {
    // Check if we're in a browser environment
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return {
        status: navigator.onLine ? 'online' : 'offline',
        timestamp: Date.now()
      };
    }

    // Default to online for non-browser environments
    return {
      status: 'online',
      timestamp: Date.now()
    };
  }

  /**
   * Start network monitoring
   */
  private startNetworkMonitoring(): void {
    if (this.networkMonitorInterval) {
      return;
    }

    // Monitor network status changes
    if (typeof globalThis !== 'undefined' && (globalThis as any).addEventListener) {
      (globalThis as any).addEventListener('online', this.handleNetworkChange.bind(this));
      (globalThis as any).addEventListener('offline', this.handleNetworkChange.bind(this));
    }

    // Periodic network check
    this.networkMonitorInterval = setInterval(() => {
      this.updateNetworkInfo();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop network monitoring
   */
  private stopNetworkMonitoring(): void {
    if (this.networkMonitorInterval) {
      clearInterval(this.networkMonitorInterval);
      this.networkMonitorInterval = undefined;
    }

    if (typeof globalThis !== 'undefined' && (globalThis as any).removeEventListener) {
      (globalThis as any).removeEventListener('online', this.handleNetworkChange.bind(this));
      (globalThis as any).removeEventListener('offline', this.handleNetworkChange.bind(this));
    }
  }

  /**
   * Handle network status change
   */
  private handleNetworkChange(): void {
    this.updateNetworkInfo();
    this.updateOfflineMode();
  }

  /**
   * Update network information
   */
  private updateNetworkInfo(): void {
    const oldStatus = this.networkInfo.status;

    // Update network info
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      this.networkInfo = {
        status: navigator.onLine ? 'online' : 'offline',
        timestamp: Date.now()
      };

      // Add connection info if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        this.networkInfo.effectiveType = connection.effectiveType;
        this.networkInfo.downlink = connection.downlink;
        this.networkInfo.rtt = connection.rtt;
      }
    }

    // Emit event if status changed
    if (oldStatus !== this.networkInfo.status) {
      this.emit({
        type: 'network-status-changed',
        timestamp: Date.now(),
        data: { ...this.networkInfo, previousStatus: oldStatus }
      });
    }
  }

  /**
   * Update offline mode based on network status and configuration
   */
  private async updateOfflineMode(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const shouldBeOffline = this.networkInfo.status === 'offline';

    if (shouldBeOffline && !this.offlineMode) {
      await this.enableOfflineMode();
    } else if (!shouldBeOffline && this.offlineMode && this.config.autoSync) {
      // Auto-sync when coming back online
      if (this.syncManager) {
        try {
          await this.syncManager.syncPendingOperations();
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }
    }
  }
}