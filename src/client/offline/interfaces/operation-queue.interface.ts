import {
  QueuedOperation,
  OperationBatch,
  QueueConfig,
  SyncOperationType,
  SyncOperationStatus,
  RetryStrategy
} from './types';

/**
 * Interface for managing operation queues
 * Handles queuing, prioritization, batching, and persistence of sync operations
 */
export interface IOperationQueue {
  /**
   * Initialize the operation queue
   */
  initialize(config: QueueConfig): Promise<void>;

  /**
   * Add an operation to the queue
   */
  enqueue(operation: QueuedOperation): Promise<void>;

  /**
   * Remove and return the next operation from the queue
   */
  dequeue(): Promise<QueuedOperation | null>;

  /**
   * Peek at the next operation without removing it
   */
  peek(): Promise<QueuedOperation | null>;

  /**
   * Get queue size
   */
  size(): Promise<number>;

  /**
   * Check if queue is empty
   */
  isEmpty(): Promise<boolean>;

  /**
   * Check if queue is full
   */
  isFull(): Promise<boolean>;

  /**
   * Clear all operations from queue
   */
  clear(): Promise<void>;

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): Promise<QueuedOperation | null>;

  /**
   * Get operations by status
   */
  getOperationsByStatus(status: SyncOperationStatus): Promise<QueuedOperation[]>;

  /**
   * Get operations by collection
   */
  getOperationsByCollection(collection: string): Promise<QueuedOperation[]>;

  /**
   * Get operations ready for processing (by priority and status)
   */
  getReadyOperations(limit?: number): Promise<QueuedOperation[]>;

  /**
   * Update operation status
   */
  updateOperationStatus(operationId: string, status: SyncOperationStatus, error?: string): Promise<void>;

  /**
   * Remove operation from queue
   */
  removeOperation(operationId: string): Promise<boolean>;

  /**
   * Create a batch of operations
   */
  createBatch(operations: QueuedOperation[]): Promise<OperationBatch>;

  /**
   * Get all batches
   */
  getBatches(): Promise<OperationBatch[]>;

  /**
   * Get batch by ID
   */
  getBatch(batchId: string): Promise<OperationBatch | null>;

  /**
   * Update batch status
   */
  updateBatchStatus(batchId: string, status: SyncOperationStatus): Promise<void>;

  /**
   * Requeue failed operations for retry
   */
  requeueFailedOperations(): Promise<number>;

  /**
   * Set operation priority
   */
  setPriority(operationId: string, priority: number): Promise<void>;

  /**
   * Get operations by priority range
   */
  getOperationsByPriority(minPriority: number, maxPriority?: number): Promise<QueuedOperation[]>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<{
    totalOperations: number;
    pendingOperations: number;
    inProgressOperations: number;
    completedOperations: number;
    failedOperations: number;
    averageWaitTime: number;
    throughput: number;
    lastProcessedTime: number;
  }>;

  /**
   * Cleanup old completed/failed operations
   */
  cleanup(): Promise<number>;

  /**
   * Export queue data for backup
   */
  export(): Promise<{
    operations: QueuedOperation[];
    batches: OperationBatch[];
    metadata: {
      exportTime: number;
      version: string;
      totalOperations: number;
    };
  }>;

  /**
   * Import queue data from backup
   */
  import(data: {
    operations?: QueuedOperation[];
    batches?: OperationBatch[];
  }): Promise<void>;

  /**
   * Shutdown queue and cleanup resources
   */
  shutdown(): Promise<void>;
}