// src/browser-sdk/storage/StorageStrategy.ts

import { StorageType } from './types';

/**
 * Defines the interface for a storage strategy.
 * Each implementation will handle a specific storage mechanism (e.g., IndexedDB, LocalStorage, Memory).
 */
export interface StorageStrategy {
  /**
   * The type of storage this strategy handles.
   */
  type: StorageType;

  /**
   * Initializes the storage strategy. This might involve opening databases or setting up listeners.
   */
  initialize(): Promise<void>;

  /**
   * Reads data from the storage.
   * @param key The key to retrieve the data for.
   * @returns A promise that resolves with the retrieved data, or null if not found.
   */
  read<T>(key: string): Promise<T | null>;

  /**
   * Writes data to the storage.
   * @param key The key under which to store the data.
   * @param value The data to store.
   * @returns A promise that resolves when the data has been successfully written.
   */
  write<T>(key: string, value: T): Promise<void>;

  /**
   * Deletes data from the storage.
   * @param key The key of the data to delete.
   * @returns A promise that resolves when the data has been successfully deleted.
   */
  delete(key: string): Promise<void>;

  /**
   * Clears all data from the storage.
   * @returns A promise that resolves when the storage has been successfully cleared.
   */
  clear(): Promise<void>;

  /**
   * Checks if the storage is available and ready for use.
   * @returns A promise that resolves to true if the storage is available, false otherwise.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Returns the estimated usage of the storage in bytes.
   * @returns A promise that resolves with the estimated storage usage.
   */
  getEstimatedUsage(): Promise<number>;
}