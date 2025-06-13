/**
 * Phase 5.3: Offline-First Support - Local Data Cache Implementation
 */

import {
  ILocalDataCache,
  CachedDataEntry,
  CacheConfig,
  StorageStats,
  StorageOptimizationStrategy
} from '../interfaces';

/**
 * IndexedDB-based local data cache implementation
 *
 * ✅ IDEA: High-performance IndexedDB caching with compression
 * ✅ IDEA: Automatic storage optimization and cleanup
 * ✅ IDEA: Query caching with intelligent invalidation
 */
export class LocalDataCache implements ILocalDataCache {
  private config: CacheConfig;
  private db?: IDBDatabase;
  private isInitialized = false;
  private readonly dbName = 'CollectionStoreOfflineCache';
  private readonly dbVersion = 1;
  private readonly storeName = 'cache';
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the cache
   */
  async initialize(config?: Partial<CacheConfig>): Promise<void> {
    const startTime = performance.now();

    try {
      if (this.isInitialized) {
        throw new Error('LocalDataCache already initialized');
      }

      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize IndexedDB
      await this.initializeIndexedDB();

      // Start cleanup interval
      if (this.config.cleanupInterval > 0) {
        this.startCleanupInterval();
      }

      this.isInitialized = true;

      const duration = performance.now() - startTime;
      console.log(`LocalDataCache initialized in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to initialize LocalDataCache:', error);
      throw error;
    }
  }

  /**
   * Shutdown the cache
   */
  async shutdown(): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.isInitialized) {
        return;
      }

      // Stop cleanup interval
      this.stopCleanupInterval();

      // Close database connection
      if (this.db) {
        this.db.close();
        this.db = undefined;
      }

      this.isInitialized = false;

      const duration = performance.now() - startTime;
      console.log(`LocalDataCache shutdown in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to shutdown LocalDataCache:', error);
      throw error;
    }
  }

  /**
   * Store data in cache
   */
  async set(collection: string, id: string, data: any, metadata?: Record<string, any>): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entry: CachedDataEntry = {
        id: `${collection}:${id}`,
        collection,
        data: this.config.compressionEnabled ? await this.compressData(data) : data,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        size: this.calculateSize(data),
        version: 1,
        metadata
      };

      await this.putEntry(entry);

      const duration = performance.now() - startTime;
      if (duration > 10) {
        console.warn(`Cache set operation took ${duration.toFixed(2)}ms (>10ms threshold)`);
      }
    } catch (error) {
      console.error('Failed to set cache entry:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from cache
   */
  async get(collection: string, id: string): Promise<CachedDataEntry | null> {
    const startTime = performance.now();

    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entryId = `${collection}:${id}`;
      const entry = await this.getEntry(entryId);

      if (!entry) {
        return null;
      }

      // Check if entry is expired
      if (this.isExpired(entry)) {
        await this.delete(collection, id);
        return null;
      }

      // Update last accessed time
      entry.lastAccessed = Date.now();
      await this.putEntry(entry);

      // Decompress data if needed
      if (this.config.compressionEnabled) {
        entry.data = await this.decompressData(entry.data);
      }

      const duration = performance.now() - startTime;
      if (duration > 10) {
        console.warn(`Cache get operation took ${duration.toFixed(2)}ms (>10ms threshold)`);
      }

      return entry;
    } catch (error) {
      console.error('Failed to get cache entry:', error);
      throw error;
    }
  }

  /**
   * Check if data exists in cache
   */
  async has(collection: string, id: string): Promise<boolean> {
    try {
      const entry = await this.get(collection, id);
      return entry !== null;
    } catch (error) {
      console.error('Failed to check cache entry:', error);
      return false;
    }
  }

  /**
   * Delete data from cache
   */
  async delete(collection: string, id: string): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entryId = `${collection}:${id}`;
      return await this.deleteEntry(entryId);
    } catch (error) {
      console.error('Failed to delete cache entry:', error);
      return false;
    }
  }

  /**
   * Get all data for a collection
   */
  async getCollection(collection: string): Promise<CachedDataEntry[]> {
    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entries = await this.getAllEntries();
      const collectionEntries = entries.filter(entry => entry.collection === collection);

      // Filter out expired entries
      const validEntries: CachedDataEntry[] = [];
      for (const entry of collectionEntries) {
        if (!this.isExpired(entry)) {
          if (this.config.compressionEnabled) {
            entry.data = await this.decompressData(entry.data);
          }
          validEntries.push(entry);
        } else {
          await this.deleteEntry(entry.id);
        }
      }

      return validEntries;
    } catch (error) {
      console.error('Failed to get collection:', error);
      return [];
    }
  }

  /**
   * Clear all data for a collection
   */
  async clearCollection(collection: string): Promise<void> {
    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entries = await this.getAllEntries();
      const collectionEntries = entries.filter(entry => entry.collection === collection);

      for (const entry of collectionEntries) {
        await this.deleteEntry(entry.id);
      }
    } catch (error) {
      console.error('Failed to clear collection:', error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await this.promisifyRequest(store.clear());
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<StorageStats> {
    try {
      if (!this.isInitialized || !this.db) {
        return {
          totalSize: 0,
          usedSize: 0,
          availableSize: 0,
          entryCount: 0,
          collections: {}
        };
      }

      const entries = await this.getAllEntries();
      let totalSize = 0;
      const collections: Record<string, { size: number; count: number }> = {};

      for (const entry of entries) {
        totalSize += entry.size;

        if (!collections[entry.collection]) {
          collections[entry.collection] = { size: 0, count: 0 };
        }

        collections[entry.collection].size += entry.size;
        collections[entry.collection].count++;
      }

      return {
        totalSize: this.config.maxSize,
        usedSize: totalSize,
        availableSize: this.config.maxSize - totalSize,
        entryCount: entries.length,
        collections
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      throw error;
    }
  }

  /**
   * Optimize storage (cleanup old/unused data)
   */
  async optimize(): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entries = await this.getAllEntries();
      const stats = await this.getStats();

      // Remove expired entries
      let removedCount = 0;
      for (const entry of entries) {
        if (this.isExpired(entry)) {
          await this.deleteEntry(entry.id);
          removedCount++;
        }
      }

      // If still over size limit, apply optimization strategy
      if (stats.usedSize > this.config.maxSize) {
        await this.applyOptimizationStrategy(entries.filter(e => !this.isExpired(e)));
      }

      const duration = performance.now() - startTime;
      console.log(`Cache optimization completed in ${duration.toFixed(2)}ms, removed ${removedCount} expired entries`);
    } catch (error) {
      console.error('Failed to optimize cache:', error);
      throw error;
    }
  }

  /**
   * Query cached data with filters
   */
  async query(collection: string, filter?: (entry: CachedDataEntry) => boolean): Promise<CachedDataEntry[]> {
    try {
      const collectionEntries = await this.getCollection(collection);

      if (!filter) {
        return collectionEntries;
      }

      return collectionEntries.filter(filter);
    } catch (error) {
      console.error('Failed to query cache:', error);
      return [];
    }
  }

  /**
   * Batch operations for better performance
   */
  async batch(operations: Array<{
    operation: 'set' | 'delete';
    collection: string;
    id: string;
    data?: any;
    metadata?: Record<string, any>;
  }>): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      for (const op of operations) {
        if (op.operation === 'set') {
          const entry: CachedDataEntry = {
            id: `${op.collection}:${op.id}`,
            collection: op.collection,
            data: this.config.compressionEnabled ? await this.compressData(op.data) : op.data,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            size: this.calculateSize(op.data),
            version: 1,
            metadata: op.metadata
          };
          store.put(entry);
        } else if (op.operation === 'delete') {
          store.delete(`${op.collection}:${op.id}`);
        }
      }

      await this.promisifyRequest(transaction);

      const duration = performance.now() - startTime;
      console.log(`Batch operation (${operations.length} ops) completed in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to execute batch operations:', error);
      throw error;
    }
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  async updateConfig(config: Partial<CacheConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // Handle cleanup interval changes
    if (oldConfig.cleanupInterval !== this.config.cleanupInterval) {
      this.stopCleanupInterval();
      if (this.config.cleanupInterval > 0) {
        this.startCleanupInterval();
      }
    }

    // Trigger optimization if max size changed
    if (oldConfig.maxSize !== this.config.maxSize) {
      await this.optimize();
    }
  }

  /**
   * Export cached data for backup
   */
  async export(): Promise<Record<string, CachedDataEntry[]>> {
    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const entries = await this.getAllEntries();
      const exportData: Record<string, CachedDataEntry[]> = {};

      for (const entry of entries) {
        if (!exportData[entry.collection]) {
          exportData[entry.collection] = [];
        }

        // Decompress data for export
        if (this.config.compressionEnabled) {
          entry.data = await this.decompressData(entry.data);
        }

        exportData[entry.collection].push(entry);
      }

      return exportData;
    } catch (error) {
      console.error('Failed to export cache data:', error);
      throw error;
    }
  }

  /**
   * Import cached data from backup
   */
  async import(data: Record<string, CachedDataEntry[]>): Promise<void> {
    try {
      if (!this.isInitialized || !this.db) {
        throw new Error('LocalDataCache not initialized');
      }

      const operations: Array<{
        operation: 'set';
        collection: string;
        id: string;
        data: any;
        metadata?: Record<string, any>;
      }> = [];

      for (const [collection, entries] of Object.entries(data)) {
        for (const entry of entries) {
          const id = entry.id.replace(`${collection}:`, '');
          operations.push({
            operation: 'set',
            collection,
            id,
            data: entry.data,
            metadata: entry.metadata
          });
        }
      }

      await this.batch(operations);
    } catch (error) {
      console.error('Failed to import cache data:', error);
      throw error;
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): CacheConfig {
    return {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      compressionEnabled: true,
      encryptionEnabled: false,
      optimizationStrategy: 'lru',
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    };
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('collection', 'collection', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  /**
   * Put entry in IndexedDB
   */
  private async putEntry(entry: CachedDataEntry): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    await this.promisifyRequest(store.put(entry));
  }

  /**
   * Get entry from IndexedDB
   */
  private async getEntry(id: string): Promise<CachedDataEntry | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const result = await this.promisifyRequest(store.get(id));
    return result || null;
  }

  /**
   * Delete entry from IndexedDB
   */
  private async deleteEntry(id: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await this.promisifyRequest(store.delete(id));
      return true;
    } catch (error) {
      console.error('Failed to delete entry:', error);
      return false;
    }
  }

  /**
   * Get all entries from IndexedDB
   */
  private async getAllEntries(): Promise<CachedDataEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const result = await this.promisifyRequest(store.getAll());
    return result || [];
  }

  /**
   * Promisify IndexedDB request
   */
  private promisifyRequest<T>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
    return new Promise((resolve, reject) => {
      if ('result' in request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        request.oncomplete = () => resolve(undefined as any);
        request.onerror = () => reject(request.error);
      }
    });
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CachedDataEntry): boolean {
    return Date.now() - entry.timestamp > this.config.maxAge;
  }

  /**
   * Calculate data size
   */
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      // Fallback to string length estimation
      return JSON.stringify(data).length * 2; // Rough UTF-16 estimation
    }
  }

  /**
   * Compress data (placeholder implementation)
   */
  private async compressData(data: any): Promise<any> {
    // For now, just return the data as-is
    // In a real implementation, you would use a compression library
    return data;
  }

  /**
   * Decompress data (placeholder implementation)
   */
  private async decompressData(data: any): Promise<any> {
    // For now, just return the data as-is
    // In a real implementation, you would use a compression library
    return data;
  }

  /**
   * Apply optimization strategy
   */
  private async applyOptimizationStrategy(entries: CachedDataEntry[]): Promise<void> {
    const stats = await this.getStats();
    const targetSize = this.config.maxSize * 0.8; // Target 80% of max size
    const excessSize = stats.usedSize - targetSize;

    if (excessSize <= 0) {
      return;
    }

    let removedSize = 0;
    let sortedEntries: CachedDataEntry[];

    switch (this.config.optimizationStrategy) {
      case 'lru':
        sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        break;
      case 'size-based':
        sortedEntries = entries.sort((a, b) => b.size - a.size);
        break;
      case 'time-based':
        sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp);
        break;
      default:
        sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    }

    for (const entry of sortedEntries) {
      if (removedSize >= excessSize) {
        break;
      }

      await this.deleteEntry(entry.id);
      removedSize += entry.size;
    }

    console.log(`Optimization removed ${removedSize} bytes using ${this.config.optimizationStrategy} strategy`);
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.optimize();
      } catch (error) {
        console.error('Cleanup interval error:', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}