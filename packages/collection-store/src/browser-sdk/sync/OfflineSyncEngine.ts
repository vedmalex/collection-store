// src/browser-sdk/sync/OfflineSyncEngine.ts

import { SyncOperation, SyncOperationType, DataConflict, ResolutionResult, QueueProcessResult, NetworkStateHandler, ChangeSet } from './types';
import { ConflictResolutionStrategies } from './ConflictResolutionStrategies';
import { BrowserStorageManager } from '../storage/BrowserStorageManager';

/**
 * Implements an offline-first synchronization engine for browser environments.
 * Manages change tracking, sync queue, conflict resolution, and network state.
 */
export class OfflineSyncEngine {
  private syncQueue: SyncOperation[] = [];
  private changeSets: Map<string, ChangeSet[]> = new Map(); // collectionName -> ChangeSet[]
  private browserStorageManager: BrowserStorageManager;
  private isProcessingQueue: boolean = false;
  private networkHandlers: NetworkStateHandler[] = [];

  constructor(browserStorageManager: BrowserStorageManager) {
    this.browserStorageManager = browserStorageManager;
    this.setupNetworkListener();
  }

  private setupNetworkListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  private handleNetworkChange(isOnline: boolean): void {
    this.networkHandlers.forEach(handler => handler(isOnline));
    if (isOnline) {
      this.processQueue(); // Attempt to sync when online
    }
  }

  /**
   * Enqueues a synchronization operation.
   * @param operation The operation to enqueue.
   */
  async enqueueOperation(operation: SyncOperation): Promise<void> {
    this.syncQueue.push(operation);
    // Persist queue to storage if needed, or process immediately if online.
    if (this.isOnline()) {
      this.processQueue();
    }
  }

  /**
   * Processes the synchronization queue, sending operations to the remote server.
   * This is a simplified implementation; actual sync would involve a remote API call.
   * @returns A promise that resolves with the result of processing the queue.
   */
  async processQueue(): Promise<QueueProcessResult> {
    if (this.isProcessingQueue || !this.isOnline()) {
      return { success: false, message: 'Queue already processing or offline.', operationsProcessed: 0, errors: [], conflicts: [] };
    }

    this.isProcessingQueue = true;
    const errors: SyncOperation[] = [];
    const conflicts: DataConflict[] = [];
    let operationsProcessed = 0;

    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift(); // Get the next operation
      if (!operation) continue; // Should not happen

      try {
        // Simulate remote sync. In a real app, this would be an API call.
        const remoteResult = await this.simulateRemoteSync(operation);

        if (remoteResult.conflict) {
          // Resolve conflict
          const resolution = await ConflictResolutionStrategies.resolve(
            remoteResult.conflict as DataConflict<any>
          );
          if (resolution.success) {
            // If resolved, apply local change or re-enqueue resolved operation
            console.log('Conflict resolved, applying data:', resolution.resolvedData);
            // In a real scenario, resolved data would be pushed to remote or applied locally
            operationsProcessed++;
          } else {
            console.error('Conflict resolution failed:', resolution.message);
            errors.push(operation);
            conflicts.push(remoteResult.conflict as DataConflict<any>);
          }
        } else if (!remoteResult.success) {
          errors.push(operation);
        } else {
          operationsProcessed++;
        }
      } catch (e) {
        console.error('Error processing sync operation:', e);
        errors.push(operation);
      }
    }

    this.isProcessingQueue = false;
    return { success: errors.length === 0, message: 'Queue processing complete.', operationsProcessed, errors, conflicts };
  }

  /**
   * Simulates a remote synchronization operation.
   * In a real application, this would be replaced with actual API calls.
   * @param operation The sync operation to simulate.
   * @returns A promise resolving with a simulated result, possibly including a conflict.
   */
  private async simulateRemoteSync<T>(operation: SyncOperation<T>): Promise<ResolutionResult<T> & { conflict?: DataConflict<T>; success: boolean }> {
    // Simulate success, failure, or conflict based on some logic
    console.log('Simulating remote sync for operation:', operation);

    // Simulate a conflict if a specific condition is met (e.g., key starts with 'conflict')
    if (operation.data && typeof operation.data === 'object' && (operation.data as any).key === 'conflict_item') {
      const localData = operation.data;
      const remoteData = { ...localData, timestamp: Date.now() - 1000, value: 'remote_value' }; // Older remote version
      return { success: false, conflict: { collectionName: operation.collectionName, key: (operation.data as any).key, localData, remoteData }, message: 'Conflict detected.' };
    }

    // Simulate a random failure for demonstration
    if (Math.random() < 0.1) { // 10% chance of failure
      return { success: false, message: 'Simulated network error.' };
    }

    // Simulate success
    return { success: true, message: 'Operation successfully synced.' };
  }

  /**
   * Tracks changes for a specific collection.
   * @param collectionName The name of the collection.
   * @param changes The ChangeSet to track.
   */
  trackChanges(collectionName: string, changes: ChangeSet): void {
    if (!this.changeSets.has(collectionName)) {
      this.changeSets.set(collectionName, []);
    }
    this.changeSets.get(collectionName)!.push(changes);
  }

  /**
   * Retrieves all changes recorded since a specific timestamp for a collection.
   * @param collectionName The name of the collection.
   * @param timestamp The timestamp from which to retrieve changes.
   * @returns An array of ChangeSet objects.
   */
  getChangesSince(collectionName: string, timestamp: number): ChangeSet[] {
    const allChanges = this.changeSets.get(collectionName) || [];
    return allChanges.filter(change => change.timestamp > timestamp);
  }

  /**
   * Checks if the browser is currently online.
   * @returns True if online, false otherwise.
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true; // Assume online if navigator is not available (e.g., Node.js env)
  }

  /**
   * Registers a handler for network state changes.
   * @param handler The function to call when network state changes.
   */
  onNetworkStateChange(handler: NetworkStateHandler): void {
    this.networkHandlers.push(handler);
  }

  /**
   * Unregisters a network state change handler.
   * @param handler The handler to remove.
   */
  offNetworkStateChange(handler: NetworkStateHandler): void {
    this.networkHandlers = this.networkHandlers.filter(h => h !== handler);
  }
}