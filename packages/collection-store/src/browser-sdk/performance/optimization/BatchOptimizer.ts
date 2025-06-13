import { CollectionItem } from '../../collection/types';

/**
 * Implements batching strategies to optimize multiple collection operations.
 * This class can be used to group create, update, or delete operations
 * to reduce network overhead and improve performance.
 */
export class BatchOptimizer {
  private queue: { type: 'create' | 'update' | 'delete'; collectionName: string; item: CollectionItem | { id: string } }[] = [];
  private batchSize: number;
  private batchIntervalMs: number;
  private timeoutId: number | null = null;
  private processBatchCallback: ((batch: typeof this.queue) => Promise<void>);

  /**
   * @param processBatchCallback A function that handles the actual processing of a batch.
   * @param batchSize The maximum number of operations to include in a single batch.
   * @param batchIntervalMs The maximum time (in ms) to wait before processing a batch, even if batchSize is not reached.
   */
  constructor(
    processBatchCallback: (batch: typeof this.queue) => Promise<void>,
    batchSize: number = 10,
    batchIntervalMs: number = 500
  ) {
    this.processBatchCallback = processBatchCallback;
    this.batchSize = batchSize;
    this.batchIntervalMs = batchIntervalMs;
  }

  /**
   * Adds a create operation to the batch queue.
   * @param collectionName The name of the collection.
   * @param item The item to create.
   */
  addCreate(collectionName: string, item: CollectionItem): void {
    this.queue.push({ type: 'create', collectionName, item });
    this.triggerBatchProcess();
  }

  /**
   * Adds an update operation to the batch queue.
   * @param collectionName The name of the collection.
   * @param item The item to update (must include id).
   */
  addUpdate(collectionName: string, item: CollectionItem): void {
    this.queue.push({ type: 'update', collectionName, item });
    this.triggerBatchProcess();
  }

  /**
   * Adds a delete operation to the batch queue.
   * @param collectionName The name of the collection.
   * @param itemId The ID of the item to delete.
   */
  addDelete(collectionName: string, itemId: string): void {
    this.queue.push({ type: 'delete', collectionName, item: { id: itemId } });
    this.triggerBatchProcess();
  }

  /**
   * Immediately processes the current batch queue.
   */
  async flush(): Promise<void> {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    await this.processBatch();
  }

  private triggerBatchProcess(): void {
    if (this.queue.length >= this.batchSize) {
      this.flush(); // Process immediately if batch size is reached
    } else if (this.timeoutId === null) {
      // Set a timeout to process the batch after a delay if not already set
      this.timeoutId = window.setTimeout(() => this.flush(), this.batchIntervalMs);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batchToProcess = [...this.queue];
    this.queue = []; // Clear the queue immediately to allow new operations
    this.timeoutId = null;

    try {
      console.log(`Processing batch of ${batchToProcess.length} operations.`);
      await this.processBatchCallback(batchToProcess);
      console.log('Batch processed successfully.');
    } catch (error) {
      console.error('Error processing batch:', error);
      // Implement error handling, e.g., retry mechanisms or logging
    }
  }
}