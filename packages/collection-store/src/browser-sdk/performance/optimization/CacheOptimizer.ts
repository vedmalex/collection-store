import { BrowserStorageManager } from '../../storage/BrowserStorageManager';
import { PerformanceMetric, PerformanceMetricType } from '../types';

/**
 * Implements caching optimization strategies for the Collection Store SDK.
 * This class interacts with BrowserStorageManager to manage cached data.
 */
export class CacheOptimizer {
  private storageManager: BrowserStorageManager;
  private cacheConfig: { enabled: boolean; maxAgeMs: number; cacheKeyPrefix: string };

  constructor(storageManager: BrowserStorageManager, config?: { maxAgeMs?: number; cacheKeyPrefix?: string }) {
    this.storageManager = storageManager;
    this.cacheConfig = {
      enabled: true,
      maxAgeMs: config?.maxAgeMs || 5 * 60 * 1000, // Default to 5 minutes
      cacheKeyPrefix: config?.cacheKeyPrefix || 'collection_cache_',
    };
  }

  /**
   * Retrieves data from cache if available and not expired.
   * @param key The key of the data to retrieve.
   * @returns A promise that resolves with the cached data, or null if not found or expired.
   */
  async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.cacheConfig.enabled) {
      return null;
    }

    const cacheKey = this.cacheConfig.cacheKeyPrefix + key;
    const cachedEntry = await this.storageManager.read<{ data: T; timestamp: number }>(cacheKey);

    if (cachedEntry) {
      const now = Date.now();
      if (now - cachedEntry.timestamp < this.cacheConfig.maxAgeMs) {
        console.log(`Cache hit for key: ${key}`);
        return cachedEntry.data;
      } else {
        console.log(`Cache expired for key: ${key}. Clearing...`);
        await this.storageManager.delete(cacheKey);
      }
    }
    console.log(`Cache miss for key: ${key}.`);
    return null;
  }

  /**
   * Stores data in the cache with a timestamp.
   * @param key The key under which to store the data.
   * @param data The data to cache.
   * @returns A promise that resolves when the data has been successfully cached.
   */
  async setToCache<T>(key: string, data: T): Promise<void> {
    if (!this.cacheConfig.enabled) {
      return;
    }

    const cacheKey = this.cacheConfig.cacheKeyPrefix + key;
    const entry = { data, timestamp: Date.now() };
    await this.storageManager.write(cacheKey, entry);
    console.log(`Data set to cache for key: ${key}.`);
  }

  /**
   * Clears a specific entry from the cache.
   * @param key The key of the cache entry to clear.
   */
  async clearCacheEntry(key: string): Promise<void> {
    const cacheKey = this.cacheConfig.cacheKeyPrefix + key;
    await this.storageManager.delete(cacheKey);
    console.log(`Cache entry cleared for key: ${key}.`);
  }

  /**
   * Clears all entries from the cache with the configured prefix.
   * Note: This is a simplified clear that relies on iterating through keys (if available via storageManager)
   * or a more direct `clear` method if the storage strategy provides it for specific keys.
   * For `BrowserStorageManager`'s `clear` method, it clears *all* data, which might be too aggressive.
   * A more robust implementation would manage cache keys within the storageManager to clear only relevant ones.
   */
  async clearAllCache(): Promise<void> {
    // A more sophisticated implementation would iterate and delete keys with the prefix
    // For now, if no specific key clearing is available, we'll log a warning or rely on expiry.
    console.warn('Clearing all cache entries is not fully implemented via prefix for BrowserStorageManager. Relying on expiry.');
    // If BrowserStorageManager had a listKeys and deleteByPrefix method, it would be used here.
  }
}