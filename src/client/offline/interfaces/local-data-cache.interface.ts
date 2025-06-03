/**
 * Phase 5.3: Offline-First Support - Local Data Cache Interface
 */

import {
  CachedDataEntry,
  CacheConfig,
  StorageStats
} from './types';

/**
 * Interface for IndexedDB-based local data caching
 *
 * ✅ IDEA: High-performance IndexedDB caching with compression
 * ✅ IDEA: Automatic storage optimization and cleanup
 * ✅ IDEA: Query caching with intelligent invalidation
 */
export interface ILocalDataCache {
  /**
   * Initialize the cache
   */
  initialize(config?: Partial<CacheConfig>): Promise<void>;

  /**
   * Shutdown the cache
   */
  shutdown(): Promise<void>;

  /**
   * Store data in cache
   */
  set(collection: string, id: string, data: any, metadata?: Record<string, any>): Promise<void>;

  /**
   * Retrieve data from cache
   */
  get(collection: string, id: string): Promise<CachedDataEntry | null>;

  /**
   * Check if data exists in cache
   */
  has(collection: string, id: string): Promise<boolean>;

  /**
   * Delete data from cache
   */
  delete(collection: string, id: string): Promise<boolean>;

  /**
   * Get all data for a collection
   */
  getCollection(collection: string): Promise<CachedDataEntry[]>;

  /**
   * Clear all data for a collection
   */
  clearCollection(collection: string): Promise<void>;

  /**
   * Clear all cached data
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<StorageStats>;

  /**
   * Optimize storage (cleanup old/unused data)
   */
  optimize(): Promise<void>;

  /**
   * Query cached data with filters
   */
  query(collection: string, filter?: (entry: CachedDataEntry) => boolean): Promise<CachedDataEntry[]>;

  /**
   * Batch operations for better performance
   */
  batch(operations: Array<{
    operation: 'set' | 'delete';
    collection: string;
    id: string;
    data?: any;
    metadata?: Record<string, any>;
  }>): Promise<void>;

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig;

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): Promise<void>;

  /**
   * Export cached data for backup
   */
  export(): Promise<Record<string, CachedDataEntry[]>>;

  /**
   * Import cached data from backup
   */
  import(data: Record<string, CachedDataEntry[]>): Promise<void>;
}