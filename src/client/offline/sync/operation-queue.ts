/**
 * Phase 5.3: Offline-First Support - Operation Queue
 * Day 3: Sync Management System
 *
 * ✅ IDEA: High-performance priority queue for sync operations
 * ✅ IDEA: Batch processing and retry strategies
 * ✅ IDEA: Persistent storage and cleanup
 */

import {
  QueuedOperation,
  OperationBatch,
  QueueConfig,
  SyncOperationStatus,
  RetryStrategy
} from '../interfaces/types';
import { IOperationQueue } from '../interfaces/operation-queue.interface';

/**
 * Queue statistics for monitoring
 */
interface QueueStats {
  totalOperations: number;
  pendingOperations: number;
  inProgressOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageWaitTime: number;
  throughput: number; // operations per second
  lastProcessedTime: number;
}

/**
 * High-performance operation queue with priority support
 * Features: Priority queuing, batch processing, retry logic, persistence
 * Performance targets: <5ms enqueue/dequeue, 1000+ operations capacity
 */
export class OperationQueue implements IOperationQueue {
  private config: QueueConfig;
  private operations: Map<string, QueuedOperation> = new Map();
  private priorityQueue: QueuedOperation[] = [];
  private batches: Map<string, OperationBatch> = new Map();
  private isInitialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  private stats: QueueStats = {
    totalOperations: 0,
    pendingOperations: 0,
    inProgressOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    averageWaitTime: 0,
    throughput: 0,
    lastProcessedTime: 0
  };

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the operation queue
   */
  async initialize(config: QueueConfig): Promise<void> {
    const startTime = performance.now();

    this.config = { ...this.getDefaultConfig(), ...config };
    this.isInitialized = true;

    // Start cleanup interval if configured
    if (this.config.cleanupInterval > 0) {
      this.startCleanupInterval();
    }

    // Load persisted operations if enabled
    if (this.config.persistToDisk) {
      await this.loadPersistedOperations();
    }

    const duration = performance.now() - startTime;
    console.log(`OperationQueue initialized in ${duration.toFixed(2)}ms`);
  }

  /**
   * Add operation to queue
   */
  async enqueue(operation: QueuedOperation): Promise<void> {
    const startTime = performance.now();

    if (!this.isInitialized) {
      throw new Error('OperationQueue not initialized');
    }

    if (this.operations.size >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    // Add to operations map
    this.operations.set(operation.id, operation);

    // Add to priority queue if pending
    if (operation.status === 'pending') {
      this.insertByPriority(operation);
      this.stats.pendingOperations++;
    }

    this.stats.totalOperations++;

    // Persist if enabled
    if (this.config.persistToDisk) {
      await this.persistOperation(operation);
    }

    const duration = performance.now() - startTime;
    if (duration > 5) {
      console.warn(`Slow enqueue operation: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Remove and return highest priority operation
   */
  async dequeue(): Promise<QueuedOperation | null> {
    const startTime = performance.now();

    if (this.priorityQueue.length === 0) {
      return null;
    }

    const operation = this.priorityQueue.shift()!;

    // Update status
    operation.status = 'in-progress';
    operation.startedAt = Date.now();

    // Update stats
    this.stats.pendingOperations--;
    this.stats.inProgressOperations++;

    const duration = performance.now() - startTime;
    if (duration > 5) {
      console.warn(`Slow dequeue operation: ${duration.toFixed(2)}ms`);
    }

    return operation;
  }

  /**
   * Peek at next operation without removing it
   */
  async peek(): Promise<QueuedOperation | null> {
    return this.priorityQueue.length > 0 ? this.priorityQueue[0] : null;
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    return this.operations.size;
  }

  /**
   * Check if queue is empty
   */
  async isEmpty(): Promise<boolean> {
    return this.operations.size === 0;
  }

  /**
   * Check if queue is full
   */
  async isFull(): Promise<boolean> {
    return this.operations.size >= this.config.maxSize;
  }

  /**
   * Set operation priority
   */
  async setPriority(operationId: string, priority: number): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.priority = Math.max(1, Math.min(10, priority));

    // Re-sort priority queue if operation is pending
    if (operation.status === 'pending') {
      this.removeFromPriorityQueue(operationId);
      this.insertByPriority(operation);
    }
  }

  /**
   * Get operations by priority range
   */
  async getOperationsByPriority(minPriority: number, maxPriority = 10): Promise<QueuedOperation[]> {
    return Array.from(this.operations.values())
      .filter(op => op.priority >= minPriority && op.priority <= maxPriority);
  }

  /**
   * Clear all operations
   */
  async clear(): Promise<void> {
    this.operations.clear();
    this.priorityQueue = [];
    this.batches.clear();

    this.stats.pendingOperations = 0;
    this.stats.inProgressOperations = 0;

    if (this.config.persistToDisk) {
      await this.clearPersistedOperations();
    }
  }

  /**
   * Get operation by ID
   */
  async getOperation(operationId: string): Promise<QueuedOperation | null> {
    return this.operations.get(operationId) || null;
  }

  /**
   * Get operations by status
   */
  async getOperationsByStatus(status: SyncOperationStatus): Promise<QueuedOperation[]> {
    return Array.from(this.operations.values()).filter(op => op.status === status);
  }

  /**
   * Get operations by collection
   */
  async getOperationsByCollection(collection: string): Promise<QueuedOperation[]> {
    return Array.from(this.operations.values()).filter(op => op.collection === collection);
  }

  /**
   * Get ready operations (pending and not scheduled for future)
   */
  async getReadyOperations(limit?: number): Promise<QueuedOperation[]> {
    const now = Date.now();
    const readyOps = this.priorityQueue.filter(op =>
      op.status === 'pending' &&
      (!op.scheduledAt || op.scheduledAt <= now)
    );

    return limit ? readyOps.slice(0, limit) : readyOps;
  }

  /**
   * Update operation status
   */
  async updateOperationStatus(
    operationId: string,
    status: SyncOperationStatus,
    error?: string
  ): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const oldStatus = operation.status;
    operation.status = status;

    if (status === 'completed') {
      operation.completedAt = Date.now();
      this.stats.inProgressOperations--;
      this.stats.completedOperations++;
    } else if (status === 'failed') {
      operation.error = error;
      operation.completedAt = Date.now();
      this.stats.inProgressOperations--;
      this.stats.failedOperations++;
    }

    // Remove from priority queue if no longer pending
    if (oldStatus === 'pending' && status !== 'pending') {
      this.removeFromPriorityQueue(operationId);
    }

    // Persist changes if enabled
    if (this.config.persistToDisk) {
      await this.persistOperation(operation);
    }
  }

  /**
   * Create batch from operations
   */
  async createBatch(operations: QueuedOperation[]): Promise<OperationBatch> {
    if (!this.config.batchingEnabled) {
      throw new Error('Batching is not enabled');
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Group by collection for efficiency
    const collection = operations[0]?.collection || 'mixed';

    const batch: OperationBatch = {
      id: batchId,
      operations,
      collection,
      totalSize: operations.length,
      estimatedDuration: this.estimateBatchDuration(operations),
      createdAt: Date.now(),
      status: 'pending'
    };

    this.batches.set(batchId, batch);
    return batch;
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(batchId: string, status: SyncOperationStatus): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    batch.status = status;
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<OperationBatch | null> {
    return this.batches.get(batchId) || null;
  }

  /**
   * Get all batches
   */
  async getBatches(): Promise<OperationBatch[]> {
    return Array.from(this.batches.values());
  }

  /**
   * Requeue failed operations that can be retried
   */
  async requeueFailedOperations(): Promise<number> {
    const failedOps = await this.getOperationsByStatus('failed');
    let requeuedCount = 0;

    for (const operation of failedOps) {
      if (operation.retryCount < operation.maxRetries) {
        // Calculate retry delay based on strategy
        const delay = this.calculateRetryDelay(operation);

        operation.status = 'pending';
        operation.retryCount++;
        operation.scheduledAt = Date.now() + delay;
        operation.error = undefined;

        // Add back to priority queue
        this.insertByPriority(operation);

        this.stats.failedOperations--;
        this.stats.pendingOperations++;
        requeuedCount++;
      }
    }

    return requeuedCount;
  }

  /**
   * Remove operation from queue
   */
  async removeOperation(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    this.operations.delete(operationId);
    this.removeFromPriorityQueue(operationId);

    // Update stats
    if (operation.status === 'pending') {
      this.stats.pendingOperations--;
    } else if (operation.status === 'in-progress') {
      this.stats.inProgressOperations--;
    }

    // Remove from persistence if enabled
    if (this.config.persistToDisk) {
      await this.removePersistedOperation(operationId);
    }

    return true;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    // Update throughput calculation
    const now = Date.now();
    if (this.stats.lastProcessedTime > 0) {
      const timeDiff = (now - this.stats.lastProcessedTime) / 1000; // seconds
      if (timeDiff > 0) {
        this.stats.throughput = this.stats.completedOperations / timeDiff;
      }
    }

    // Calculate average wait time
    const completedOps = Array.from(this.operations.values()).filter(op =>
      op.status === 'completed' && op.startedAt && op.createdAt
    );

    if (completedOps.length > 0) {
      const totalWaitTime = completedOps.reduce((sum, op) =>
        sum + (op.startedAt! - op.createdAt), 0
      );
      this.stats.averageWaitTime = totalWaitTime / completedOps.length;
    }

    return { ...this.stats };
  }

  /**
   * Cleanup old completed operations
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const retentionPeriod = this.config.retentionPeriod;
    let cleanedCount = 0;

    for (const [id, operation] of this.operations.entries()) {
      if (
        (operation.status === 'completed' || operation.status === 'failed') &&
        operation.completedAt &&
        (now - operation.completedAt) > retentionPeriod
      ) {
        await this.removeOperation(id);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Export queue data for backup
   */
  async export(): Promise<{
    operations: QueuedOperation[];
    batches: OperationBatch[];
    metadata: {
      exportTime: number;
      version: string;
      totalOperations: number;
    };
  }> {
    return {
      operations: Array.from(this.operations.values()),
      batches: Array.from(this.batches.values()),
      metadata: {
        exportTime: Date.now(),
        version: '1.0.0',
        totalOperations: this.operations.size
      }
    };
  }

  /**
   * Import queue data from backup
   */
  async import(data: {
    operations?: QueuedOperation[];
    batches?: OperationBatch[];
  }): Promise<void> {
    if (data.operations) {
      for (const operation of data.operations) {
        await this.enqueue(operation);
      }
    }

    if (data.batches) {
      for (const batch of data.batches) {
        this.batches.set(batch.id, batch);
      }
    }
  }

  /**
   * Shutdown queue and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Final persistence if enabled
    if (this.config.persistToDisk) {
      await this.persistAllOperations();
    }

    this.isInitialized = false;
    console.log('OperationQueue shut down');
  }

  // ===== PRIVATE METHODS =====

  private getDefaultConfig(): QueueConfig {
    return {
      maxSize: 1000,
      persistToDisk: false,
      priorityEnabled: true,
      batchingEnabled: true,
      compressionEnabled: false,
      encryptionEnabled: false,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    };
  }

  private insertByPriority(operation: QueuedOperation): void {
    if (!this.config.priorityEnabled) {
      this.priorityQueue.push(operation);
      return;
    }

    // Binary search for insertion point (higher priority = lower index)
    let left = 0;
    let right = this.priorityQueue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.priorityQueue[mid].priority >= operation.priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    this.priorityQueue.splice(left, 0, operation);
  }

  private removeFromPriorityQueue(operationId: string): void {
    const index = this.priorityQueue.findIndex(op => op.id === operationId);
    if (index !== -1) {
      this.priorityQueue.splice(index, 1);
    }
  }

  private calculateRetryDelay(operation: QueuedOperation): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute

    switch (operation.retryStrategy) {
      case 'exponential':
        return Math.min(baseDelay * Math.pow(2, operation.retryCount), maxDelay);

      case 'linear':
        return Math.min(baseDelay * (operation.retryCount + 1), maxDelay);

      case 'fixed':
        return baseDelay;

      case 'none':
      default:
        return 0;
    }
  }

  private estimateBatchDuration(operations: QueuedOperation[]): number {
    // Base estimate: 100ms per operation
    const baseTimePerOp = 100;

    // Batch efficiency: larger batches are more efficient
    const batchEfficiency = Math.max(0.5, 1 - (operations.length * 0.05));

    return operations.length * baseTimePerOp * batchEfficiency;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanup();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} old operations`);
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }, this.config.cleanupInterval);
  }

  // ===== PERSISTENCE METHODS (Placeholder implementations) =====

  private async loadPersistedOperations(): Promise<void> {
    // Placeholder: In a real implementation, this would load from IndexedDB
    console.log('Loading persisted operations (placeholder)');
  }

  private async persistOperation(operation: QueuedOperation): Promise<void> {
    // Placeholder: In a real implementation, this would save to IndexedDB
    // console.log(`Persisting operation ${operation.id} (placeholder)`);
  }

  private async persistAllOperations(): Promise<void> {
    // Placeholder: In a real implementation, this would save all operations
    console.log('Persisting all operations (placeholder)');
  }

  private async clearPersistedOperations(): Promise<void> {
    // Placeholder: In a real implementation, this would clear IndexedDB
    console.log('Clearing persisted operations (placeholder)');
  }

  private async removePersistedOperation(operationId: string): Promise<void> {
    // Placeholder: In a real implementation, this would remove from IndexedDB
    // console.log(`Removing persisted operation ${operationId} (placeholder)`);
  }
}