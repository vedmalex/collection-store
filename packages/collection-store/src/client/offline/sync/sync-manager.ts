/**
 * Phase 5.3: Offline-First Support - Sync Manager
 * Day 3: Sync Management System
 *
 * ✅ IDEA: Central orchestration of sync operations
 * ✅ IDEA: Adaptive sync strategies based on network conditions
 * ✅ IDEA: Integration with queue and network components
 */

import {
  SyncConfig,
  SyncStats,
  SyncProgress,
  SyncEvent,
  SyncEventType,
  QueuedOperation,
  OperationBatch,
  SyncManagerConfig,
  NetworkInfo,
  SyncStrategy,
  SyncOperationStatus
} from '../interfaces/types';
import { ISyncManager } from '../interfaces/sync-manager.interface';
import { IOperationQueue } from '../interfaces/operation-queue.interface';
import { INetworkDetector } from '../interfaces/network-detector.interface';
import { IConflictResolver } from '../interfaces/conflict-resolver.interface';

/**
 * Central sync management system
 * Features: Strategy adaptation, progress monitoring, event system
 * Performance targets: <100ms operation processing, 500+ ops/sec throughput
 */
export class SyncManager implements ISyncManager {
  private config: SyncManagerConfig;
  private isInitialized = false;
  private isActive = false;
  private isPaused = false;
  private syncInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, ((event: SyncEvent) => void)[]> = new Map();

  // Dependencies
  private operationQueue?: IOperationQueue;
  private networkDetector?: INetworkDetector;
  private conflictResolver?: IConflictResolver;

  // Statistics
  private stats: SyncStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    conflictsResolved: 0,
    averageProcessingTime: 0,
    throughput: 0,
    lastSyncTime: 0,
    networkEfficiency: 0,
    queueSize: 0,
    retryCount: 0
  };

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the sync manager
   */
  async initialize(config: SyncManagerConfig): Promise<void> {
    const startTime = performance.now();

    this.config = { ...this.getDefaultConfig(), ...config };

    // Initialize dependencies if provided
    if (config.operationQueue) {
      this.operationQueue = config.operationQueue;
    }

    if (config.networkDetector) {
      this.networkDetector = config.networkDetector;
    }

    if (config.conflictResolver) {
      this.conflictResolver = config.conflictResolver;
    }

    this.isInitialized = true;

    const duration = performance.now() - startTime;
    console.log(`SyncManager initialized in ${duration.toFixed(2)}ms`);
  }

  /**
   * Start sync operations
   */
  async startSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SyncManager not initialized');
    }

    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.isPaused = false;

    // Start sync interval if configured
    if (this.config.syncConfig.syncInterval > 0) {
      this.syncInterval = setInterval(async () => {
        await this.processSyncCycle();
      }, this.config.syncConfig.syncInterval);
    }

    this.emitEvent({
      type: 'sync-started',
      timestamp: Date.now(),
      data: {}
    });

    console.log('Sync manager started');
  }

  /**
   * Stop sync operations
   */
  async stopSync(): Promise<void> {
    this.isActive = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.emitEvent({
      type: 'sync-stopped',
      timestamp: Date.now(),
      data: {}
    });

    console.log('Sync manager stopped');
  }

  /**
   * Pause sync operations
   */
  async pauseSync(): Promise<void> {
    this.isPaused = true;

    this.emitEvent({
      type: 'sync-paused',
      timestamp: Date.now(),
      data: {}
    });

    console.log('Sync manager paused');
  }

  /**
   * Resume sync operations
   */
  async resumeSync(): Promise<void> {
    this.isPaused = false;

    this.emitEvent({
      type: 'sync-resumed',
      timestamp: Date.now(),
      data: {}
    });

    console.log('Sync manager resumed');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isActive: boolean;
    isPaused: boolean;
    currentStrategy: SyncStrategy;
    queueSize: number;
    networkQuality: string;
    lastSyncTime: number;
  }> {
    const queueSize = this.operationQueue ? await this.operationQueue.size() : 0;
    const networkInfo = this.networkDetector ? await this.networkDetector.getNetworkInfo() : null;

    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      currentStrategy: this.config.syncConfig.strategy,
      queueSize,
      networkQuality: networkInfo?.quality || 'unknown',
      lastSyncTime: this.stats.lastSyncTime
    };
  }

  /**
   * Get sync progress
   */
  async getSyncProgress(): Promise<SyncProgress> {
    const queueSize = this.operationQueue ? await this.operationQueue.size() : 0;
    const pendingOps = this.operationQueue ? await this.operationQueue.getOperationsByStatus('pending') : [];
    const inProgressOps = this.operationQueue ? await this.operationQueue.getOperationsByStatus('in-progress') : [];

    return {
      totalOperations: queueSize,
      completedOperations: this.stats.successfulOperations,
      failedOperations: this.stats.failedOperations,
      pendingOperations: pendingOps.length,
      inProgressOperations: inProgressOps.length,
      currentOperation: inProgressOps[0]?.id || null,
      estimatedTimeRemaining: this.estimateTimeRemaining(pendingOps.length),
      progressPercentage: this.calculateProgressPercentage()
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    // Update queue size
    if (this.operationQueue) {
      this.stats.queueSize = await this.operationQueue.size();
    }

    // Update network efficiency
    if (this.networkDetector) {
      this.stats.networkEfficiency = await this.networkDetector.getEfficiencyScore();
    }

    return { ...this.stats };
  }

  /**
   * Force sync operation
   */
  async forceSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SyncManager not initialized');
    }

    await this.processSyncCycle();
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (event: SyncEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (event: SyncEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Update sync configuration
   */
  async updateConfig(config: Partial<SyncManagerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    this.emitEvent({
      type: 'config-updated',
      timestamp: Date.now(),
      data: { config }
    });
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    issues: string[];
    performance: {
      averageProcessingTime: number;
      throughput: number;
      errorRate: number;
    };
  }> {
    const issues: string[] = [];
    let isHealthy = true;

    // Check dependencies
    if (!this.operationQueue) {
      issues.push('Operation queue not available');
      isHealthy = false;
    }

    if (!this.networkDetector) {
      issues.push('Network detector not available');
      isHealthy = false;
    }

    // Check performance
    const errorRate = this.stats.totalOperations > 0
      ? this.stats.failedOperations / this.stats.totalOperations
      : 0;

    if (errorRate > 0.1) { // 10% error rate threshold
      issues.push('High error rate detected');
      isHealthy = false;
    }

    if (this.stats.averageProcessingTime > 1000) { // 1 second threshold
      issues.push('Slow processing time detected');
      isHealthy = false;
    }

    return {
      isHealthy,
      issues,
      performance: {
        averageProcessingTime: this.stats.averageProcessingTime,
        throughput: this.stats.throughput,
        errorRate
      }
    };
  }

  /**
   * Shutdown sync manager
   */
  async shutdown(): Promise<void> {
    await this.stopSync();
    this.eventListeners.clear();
    this.isInitialized = false;
    console.log('SyncManager shut down');
  }

  // ===== PRIVATE METHODS =====

  private getDefaultConfig(): SyncManagerConfig {
    return {
      syncConfig: {
        enabled: true,
        strategy: 'adaptive',
        batchSize: 10,
        maxRetries: 3,
        retryStrategy: 'exponential',
        syncInterval: 30000, // 30 seconds
        maxQueueSize: 1000,
        priorityThreshold: 5,
        networkQualityThreshold: 'poor',
        autoResolveConflicts: true,
        compressionEnabled: false,
        encryptionEnabled: false,
        backgroundSync: true,
        adaptiveStrategy: true
      },
      queueConfig: {
        maxSize: 1000,
        persistToDisk: false,
        priorityEnabled: true,
        batchingEnabled: true,
        compressionEnabled: false,
        encryptionEnabled: false,
        retentionPeriod: 7 * 24 * 60 * 60 * 1000,
        cleanupInterval: 60 * 60 * 1000
      },
      networkConfig: {
        enabled: true,
        checkInterval: 30000,
        timeoutDuration: 5000,
        testUrls: ['https://httpbin.org/status/200'],
        qualityTestEnabled: true,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      },
      performanceTargets: {
        maxSyncTime: 5000,
        maxOperationTime: 100,
        maxQueueProcessingTime: 1000,
        targetThroughput: 500
      }
    };
  }

  private async processSyncCycle(): Promise<void> {
    if (!this.isActive || this.isPaused || !this.operationQueue) {
      return;
    }

    const startTime = performance.now();

    try {
      // Get network status
      const networkInfo = this.networkDetector ? await this.networkDetector.getNetworkInfo() : null;

      // Determine sync strategy
      const strategy = await this.determineSyncStrategy(networkInfo);

      // Process operations based on strategy
      await this.processOperationsByStrategy(strategy);

      // Update statistics
      this.updateStats(performance.now() - startTime);

      this.emitEvent({
        type: 'sync-cycle-completed',
        timestamp: Date.now(),
        data: { strategy, duration: performance.now() - startTime }
      });

    } catch (error) {
      console.error('Error in sync cycle:', error);

      this.emitEvent({
        type: 'sync-error',
        timestamp: Date.now(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async determineSyncStrategy(networkInfo: NetworkInfo | null): Promise<SyncStrategy> {
    if (!this.config.syncConfig.adaptiveStrategy) {
      return this.config.syncConfig.strategy;
    }

    if (!networkInfo || !networkInfo.isOnline) {
      return 'manual';
    }

    // Use network detector recommendation if available
    if (this.networkDetector) {
      const recommendation = await this.networkDetector.getRecommendedSyncStrategy();
      return recommendation as SyncStrategy;
    }

    // Fallback to quality-based strategy
    switch (networkInfo.quality) {
      case 'excellent':
        return 'immediate';
      case 'good':
        return 'adaptive';
      case 'poor':
        return 'batched';
      default:
        return 'manual';
    }
  }

  private async processOperationsByStrategy(strategy: SyncStrategy): Promise<void> {
    if (!this.operationQueue) {
      return;
    }

    switch (strategy) {
      case 'immediate':
        await this.processImmediateSync();
        break;
      case 'batched':
        await this.processBatchedSync();
        break;
      case 'scheduled':
        await this.processScheduledSync();
        break;
      case 'adaptive':
        await this.processAdaptiveSync();
        break;
      case 'manual':
        // No automatic processing
        break;
    }
  }

  private async processImmediateSync(): Promise<void> {
    if (!this.operationQueue) return;

    const operations = await this.operationQueue.getReadyOperations(1);

    for (const operation of operations) {
      await this.processOperation(operation);
    }
  }

  private async processBatchedSync(): Promise<void> {
    if (!this.operationQueue) return;

    const operations = await this.operationQueue.getReadyOperations(this.config.syncConfig.batchSize);

    if (operations.length > 0) {
      const batch = await this.operationQueue.createBatch(operations);
      await this.processBatch(batch);
    }
  }

  private async processScheduledSync(): Promise<void> {
    // Process only high-priority operations
    if (!this.operationQueue) return;

    const highPriorityOps = await this.operationQueue.getOperationsByPriority(
      this.config.syncConfig.priorityThreshold
    );

    const readyOps = highPriorityOps.filter(op =>
      op.status === 'pending' &&
      (!op.scheduledAt || op.scheduledAt <= Date.now())
    );

    for (const operation of readyOps.slice(0, 3)) { // Limit to 3 operations
      await this.processOperation(operation);
    }
  }

  private async processAdaptiveSync(): Promise<void> {
    // Adaptive strategy based on current conditions
    const queueSize = this.operationQueue ? await this.operationQueue.size() : 0;

    if (queueSize > 50) {
      await this.processBatchedSync();
    } else {
      await this.processImmediateSync();
    }
  }

  private async processOperation(operation: QueuedOperation): Promise<void> {
    const startTime = performance.now();

    try {
      // Update operation status
      if (this.operationQueue) {
        await this.operationQueue.updateOperationStatus(operation.id, 'in-progress');
      }

      // Simulate operation processing
      await this.simulateOperationProcessing(operation);

      // Mark as completed
      if (this.operationQueue) {
        await this.operationQueue.updateOperationStatus(operation.id, 'completed');
      }

      this.stats.successfulOperations++;
      this.stats.totalOperations++;

      this.emitEvent({
        type: 'operation-completed',
        timestamp: Date.now(),
        data: { operationId: operation.id, duration: performance.now() - startTime }
      });

    } catch (error) {
      // Mark as failed
      if (this.operationQueue) {
        await this.operationQueue.updateOperationStatus(
          operation.id,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      this.stats.failedOperations++;
      this.stats.totalOperations++;

      this.emitEvent({
        type: 'operation-failed',
        timestamp: Date.now(),
        data: { operationId: operation.id, error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async processBatch(batch: any): Promise<void> {
    // Placeholder for batch processing
    console.log(`Processing batch ${batch.id} with ${batch.operations.length} operations`);

    for (const operation of batch.operations) {
      await this.processOperation(operation);
    }
  }

  private async simulateOperationProcessing(operation: QueuedOperation): Promise<void> {
    // Simulate processing time
    const processingTime = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, processingTime));
  }

  private updateStats(cycleDuration: number): void {
    this.stats.lastSyncTime = Date.now();

    // Update average processing time
    if (this.stats.averageProcessingTime === 0) {
      this.stats.averageProcessingTime = cycleDuration;
    } else {
      this.stats.averageProcessingTime = this.stats.averageProcessingTime * 0.8 + cycleDuration * 0.2;
    }

    // Update throughput (operations per second)
    if (this.stats.totalOperations > 0) {
      const timeElapsed = (Date.now() - this.stats.lastSyncTime) / 1000;
      if (timeElapsed > 0) {
        this.stats.throughput = this.stats.totalOperations / timeElapsed;
      }
    }
  }

  private estimateTimeRemaining(pendingOperations: number): number {
    if (pendingOperations === 0 || this.stats.averageProcessingTime === 0) {
      return 0;
    }

    return pendingOperations * this.stats.averageProcessingTime;
  }

  private calculateProgressPercentage(): number {
    const total = this.stats.successfulOperations + this.stats.failedOperations;
    if (total === 0) {
      return 0;
    }

    return Math.round((this.stats.successfulOperations / total) * 100);
  }

  private emitEvent(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in sync event listener:', error);
        }
      });
    }
  }
}