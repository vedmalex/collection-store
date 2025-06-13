// src/browser-sdk/storage/StorageSelectionAlgorithm.ts

import { StorageStrategy } from './StorageStrategy';
import { StorageType, StorageRequirements } from './types';
import { IndexedDBStorage } from './adapters/IndexedDBStorage';
import { LocalStorageStorage } from './adapters/LocalStorageStorage';
import { MemoryStorage } from './adapters/MemoryStorage';

/**
 * Manages the selection of the optimal storage strategy based on requirements.
 */
export class StorageSelectionAlgorithm {
  private strategies: Map<StorageType, StorageStrategy>;

  constructor() {
    this.strategies = new Map<StorageType, StorageStrategy>();
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    // Register available storage strategies.
    // Note: IndexedDB and LocalStorage might need specific names or prefixes for production.
    this.strategies.set(StorageType.IndexedDB, new IndexedDBStorage());
    this.strategies.set(StorageType.LocalStorage, new LocalStorageStorage());
    this.strategies.set(StorageType.Memory, new MemoryStorage());
  }

  /**
   * Selects the optimal storage strategy based on provided requirements.
   * Prioritizes IndexedDB > LocalStorage > Memory based on persistence and capacity.
   * @param requirements The storage requirements.
   * @returns The selected StorageStrategy, or null if no suitable strategy is found.
   */
  async selectOptimalStorage(requirements: StorageRequirements): Promise<StorageStrategy | null> {
    // Check IndexedDB first due to its capacity and persistence capabilities
    const indexedDBStrategy = this.strategies.get(StorageType.IndexedDB);
    if (indexedDBStrategy && (await indexedDBStrategy.isAvailable())) {
      // For IndexedDB, consider size and persistence requirements directly
      if (requirements.estimatedSize > 5 * 1024 * 1024) { // > 5MB, suitable for IndexedDB
        // Further checks for actual quota could be added here
        return indexedDBStrategy;
      }
      if (requirements.persistenceLevel === 'permanent') {
        return indexedDBStrategy;
      }
    }

    // Check LocalStorage next for session-level persistence and smaller data
    const localStorageStrategy = this.strategies.get(StorageType.LocalStorage);
    if (localStorageStrategy && (await localStorageStrategy.isAvailable())) {
      if (requirements.persistenceLevel === 'session' || requirements.estimatedSize <= 5 * 1024 * 1024) { // <= 5MB
        return localStorageStrategy;
      }
    }

    // Fallback to MemoryStorage if no persistent or suitable storage is found
    const memoryStorageStrategy = this.strategies.get(StorageType.Memory);
    if (memoryStorageStrategy && (await memoryStorageStrategy.isAvailable())) {
      return memoryStorageStrategy;
    }

    console.warn('No suitable storage strategy found for given requirements.', requirements);
    return null;
  }

  /**
   * Checks the availability of a specific storage type.
   * @param type The type of storage to check.
   * @returns A promise that resolves to true if the storage type is available, false otherwise.
   */
  async checkStorageAvailability(type: StorageType): Promise<boolean> {
    const strategy = this.strategies.get(type);
    if (strategy) {
      return strategy.isAvailable();
    }
    return false;
  }
}