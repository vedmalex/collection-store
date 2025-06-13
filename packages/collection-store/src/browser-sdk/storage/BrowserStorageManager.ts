// src/browser-sdk/storage/BrowserStorageManager.ts

import { StorageStrategy } from './StorageStrategy';
import { StorageSelectionAlgorithm } from './StorageSelectionAlgorithm';
import { StorageType, StorageRequirements, QuotaInfo, OptimizationResult, MigrationResult, SyncResult } from './types';

/**
 * Manages browser-specific storage, selecting the optimal strategy based on requirements.
 */
export class BrowserStorageManager {
  private storageSelectionAlgorithm: StorageSelectionAlgorithm;
  private activeStrategy: StorageStrategy | null = null;

  constructor() {
    this.storageSelectionAlgorithm = new StorageSelectionAlgorithm();
  }

  /**
   * Initializes the BrowserStorageManager and selects an optimal storage strategy.
   * @param requirements Optional storage requirements to guide the initial selection.
   */
  async initialize(requirements?: StorageRequirements): Promise<void> {
    this.activeStrategy = await this.storageSelectionAlgorithm.selectOptimalStorage(
      requirements || { estimatedSize: 0, persistenceLevel: 'session', performanceRequirements: 'medium' }
    );

    if (!this.activeStrategy) {
      throw new Error('Failed to initialize BrowserStorageManager: No suitable storage strategy found.');
    }

    await this.activeStrategy.initialize();
  }

  /**
   * Reads data from the active storage strategy.
   * @param key The key to retrieve the data for.
   * @returns A promise that resolves with the retrieved data, or null if not found.
   */
  async read<T>(key: string): Promise<T | null> {
    if (!this.activeStrategy) {
      throw new Error('BrowserStorageManager is not initialized.');
    }
    return this.activeStrategy.read<T>(key);
  }

  /**
   * Writes data to the active storage strategy.
   * @param key The key under which to store the data.
   * @param value The data to store.
   * @returns A promise that resolves when the data has been successfully written.
   */
  async write<T>(key: string, value: T): Promise<void> {
    if (!this.activeStrategy) {
      throw new Error('BrowserStorageManager is not initialized.');
    }
    return this.activeStrategy.write<T>(key, value);
  }

  /**
   * Deletes data from the active storage strategy.
   * @param key The key of the data to delete.
   * @returns A promise that resolves when the data has been successfully deleted.
   */
  async delete(key: string): Promise<void> {
    if (!this.activeStrategy) {
      throw new Error('BrowserStorageManager is not initialized.');
    }
    return this.activeStrategy.delete(key);
  }

  /**
   * Clears all data from the active storage strategy.
   * @returns A promise that resolves when the data has been successfully cleared.
   */
  async clear(): Promise<void> {
    if (!this.activeStrategy) {
      throw new Error('BrowserStorageManager is not initialized.');
    }
    return this.activeStrategy.clear();
  }

  /**
   * Returns the type of the currently active storage strategy.
   * @returns The StorageType of the active strategy, or null if not initialized.
   */
  getActiveStorageType(): StorageType | null {
    return this.activeStrategy ? this.activeStrategy.type : null;
  }

  /**
   * Checks if a specific storage type is available.
   * @param type The type of storage to check.
   * @returns A promise that resolves to true if the storage type is available, false otherwise.
   */
  async checkStorageAvailability(type: StorageType): Promise<boolean> {
    return this.storageSelectionAlgorithm.checkStorageAvailability(type);
  }

  /**
   * Gets information about the storage quota for the active strategy (if applicable).
   * Note: This might not be fully supported by all underlying storage mechanisms (e.g., MemoryStorage).
   * For IndexedDB/CacheStorage, it tries to use navigator.storage.estimate().
   * @returns A promise that resolves with QuotaInfo, or null if not available.
   */
  async getQuotaInfo(): Promise<QuotaInfo | null> {
    if (!this.activeStrategy) {
      throw new Error('BrowserStorageManager is not initialized.');
    }
    // This is a simplified approach. A more robust implementation would check the active strategy's type
    // and call specific quota methods if available, or use a generic estimate for browser storage.
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          total: estimate.quota || 0,
          used: estimate.usage || 0,
          remaining: (estimate.quota || 0) - (estimate.usage || 0)
        };
      } catch (e) {
        console.warn('Could not get storage quota estimate:', e);
        return null;
      }
    }
    return null;
  }

  /**
   * Attempts to optimize the active storage strategy.
   * @returns A promise that resolves with the result of the optimization.
   */
  async optimizeStorage(): Promise<OptimizationResult> {
    if (!this.activeStrategy) {
      throw new Error('BrowserStorageManager is not initialized.');
    }
    // Currently, StorageStrategy interface does not define an optimize method.
    // This would require a new method in StorageStrategy or specific logic per strategy.
    console.warn('Optimization not implemented for active storage strategy.');
    return { optimized: false, message: 'Optimization not supported by active strategy.' };
  }

  /**
   * Migrates data from one storage type to another.
   * @param fromType The StorageType to migrate data from.
   * @param toType The StorageType to migrate data to.
   * @returns A promise that resolves with the result of the migration.
   */
  async migrateData(fromType: StorageType, toType: StorageType): Promise<MigrationResult> {
    // This requires iterating through the 'from' storage and writing to the 'to' storage.
    // A more complex implementation would handle data transformations and conflict resolution.
    console.warn('Data migration not fully implemented.');
    return { success: false, message: 'Data migration not fully implemented.' };
  }

  /**
   * Synchronizes data across different storage mechanisms (e.g., local to cloud).
   * @returns A promise that resolves with the result of the synchronization.
   */
  async syncStorages(): Promise<SyncResult> {
    // This is a placeholder for future synchronization logic (e.g., with a remote server).
    console.warn('Storage synchronization not implemented.');
    return { success: false, message: 'Storage synchronization not implemented.' };
  }
}