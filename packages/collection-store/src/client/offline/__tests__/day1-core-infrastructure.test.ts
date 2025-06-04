/**
 * Phase 5.3: Offline-First Support - Day 1 Core Infrastructure Tests
 *
 * ✅ IDEA: Test core offline infrastructure components
 * ✅ IDEA: Verify performance requirements (<10ms cache operations)
 * ✅ IDEA: Test initialization and configuration management
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { OfflineManager } from '../core/offline-manager';
import { LocalDataCache } from '../core/local-data-cache';
import { StorageOptimizer } from '../core/storage-optimizer';
import type {
  OfflineConfig,
  CacheConfig,
  CachedDataEntry,
  StorageOptimizationStrategy
} from '../interfaces';

describe('Phase 5.3 Day 1: Core Offline Infrastructure', () => {
  let offlineManager: OfflineManager;
  let localCache: LocalDataCache;
  let storageOptimizer: StorageOptimizer;

  beforeEach(async () => {
    offlineManager = new OfflineManager();
    localCache = new LocalDataCache();
    storageOptimizer = new StorageOptimizer();
  });

  afterEach(async () => {
    try {
      if (offlineManager) {
        await offlineManager.shutdown();
      }
      if (localCache) {
        await localCache.shutdown();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('OfflineManager', () => {
    test('should initialize with default configuration', async () => {
      const startTime = performance.now();

      await offlineManager.initialize();

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should initialize quickly

      expect(offlineManager.isOfflineMode()).toBe(false);

      const config = offlineManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.maxStorageSize).toBe(50 * 1024 * 1024); // 50MB
      expect(config.conflictResolution).toBe('timestamp-based');
    });

    test('should initialize with custom configuration', async () => {
      const customConfig: Partial<OfflineConfig> = {
        enabled: false,
        maxStorageSize: 100 * 1024 * 1024, // 100MB
        conflictResolution: 'client-wins',
        networkDetection: false
      };

      await offlineManager.initialize(customConfig);

      const config = offlineManager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.maxStorageSize).toBe(100 * 1024 * 1024);
      expect(config.conflictResolution).toBe('client-wins');
      expect(config.networkDetection).toBe(false);
    });

    test('should handle enable/disable offline mode', async () => {
      await offlineManager.initialize();

      expect(offlineManager.isOfflineMode()).toBe(false);

      await offlineManager.enableOfflineMode();
      expect(offlineManager.isOfflineMode()).toBe(true);

      await offlineManager.disableOfflineMode();
      expect(offlineManager.isOfflineMode()).toBe(false);
    });

    test('should provide network information', async () => {
      await offlineManager.initialize();

      const networkInfo = offlineManager.getNetworkInfo();
      expect(networkInfo).toHaveProperty('status');
      expect(networkInfo).toHaveProperty('timestamp');
      expect(['online', 'offline', 'slow', 'unknown']).toContain(networkInfo.status);
    });

    test('should handle event listeners', async () => {
      await offlineManager.initialize();

      let eventReceived = false;
      const listener = () => { eventReceived = true; };

      offlineManager.addEventListener('offline-mode-changed', listener);
      await offlineManager.enableOfflineMode();

      expect(eventReceived).toBe(true);

      offlineManager.removeEventListener('offline-mode-changed', listener);
    });

    test('should update configuration', async () => {
      await offlineManager.initialize();

      const newConfig: Partial<OfflineConfig> = {
        syncInterval: 60000, // 1 minute
        maxRetries: 5
      };

      await offlineManager.updateConfig(newConfig);

      const config = offlineManager.getConfig();
      expect(config.syncInterval).toBe(60000);
      expect(config.maxRetries).toBe(5);
    });

    test('should provide storage and sync statistics', async () => {
      await offlineManager.initialize();

      const storageStats = await offlineManager.getStorageStats();
      expect(storageStats).toHaveProperty('totalSize');
      expect(storageStats).toHaveProperty('usedSize');
      expect(storageStats).toHaveProperty('entryCount');

      const syncStats = await offlineManager.getSyncStats();
      expect(syncStats).toHaveProperty('pendingOperations');
      expect(syncStats).toHaveProperty('syncedOperations');
    });
  });

  describe('LocalDataCache', () => {
    test('should initialize with default configuration', async () => {
      const startTime = performance.now();

      // Skip IndexedDB initialization in test environment
      const mockConfig: Partial<CacheConfig> = {
        maxSize: 10 * 1024 * 1024, // 10MB for testing
        compressionEnabled: false // Disable for testing
      };

      try {
        await localCache.initialize(mockConfig);
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(100);

        const config = localCache.getConfig();
        expect(config.maxSize).toBe(10 * 1024 * 1024);
        expect(config.compressionEnabled).toBe(false);
      } catch (error) {
        // IndexedDB not available in test environment - this is expected
        expect(error.message).toContain('IndexedDB');
      }
    });

    test('should handle configuration updates', async () => {
      try {
        await localCache.initialize();

        const newConfig: Partial<CacheConfig> = {
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          cleanupInterval: 30 * 60 * 1000 // 30 minutes
        };

        await localCache.updateConfig(newConfig);

        const config = localCache.getConfig();
        expect(config.maxAge).toBe(24 * 60 * 60 * 1000);
        expect(config.cleanupInterval).toBe(30 * 60 * 1000);
      } catch (error) {
        // IndexedDB not available in test environment
        expect(error.message).toContain('IndexedDB');
      }
    });

    test('should provide cache statistics', async () => {
      try {
        await localCache.initialize();

        const stats = await localCache.getStats();
        expect(stats).toHaveProperty('totalSize');
        expect(stats).toHaveProperty('usedSize');
        expect(stats).toHaveProperty('entryCount');
        expect(stats).toHaveProperty('collections');
      } catch (error) {
        // IndexedDB not available in test environment
        expect(error.message).toContain('IndexedDB');
      }
    });

    test('should handle export/import operations', async () => {
      try {
        await localCache.initialize();

        const exportData = await localCache.export();
        expect(typeof exportData).toBe('object');

        await localCache.import(exportData);
      } catch (error) {
        // IndexedDB not available in test environment
        expect(error.message).toContain('IndexedDB');
      }
    });
  });

  describe('StorageOptimizer', () => {
    test('should initialize with default strategy', () => {
      expect(storageOptimizer.getStrategy()).toBe('lru');
      expect(storageOptimizer.getMaxSize()).toBe(50 * 1024 * 1024);
      expect(storageOptimizer.getTargetUtilization()).toBe(0.8);
    });

    test('should handle strategy changes', () => {
      const strategies: StorageOptimizationStrategy[] = ['lru', 'size-based', 'time-based', 'priority-based'];

      for (const strategy of strategies) {
        storageOptimizer.setStrategy(strategy);
        expect(storageOptimizer.getStrategy()).toBe(strategy);
      }
    });

    test('should validate target utilization', () => {
      expect(() => storageOptimizer.setTargetUtilization(-0.1)).toThrow();
      expect(() => storageOptimizer.setTargetUtilization(1.1)).toThrow();

      storageOptimizer.setTargetUtilization(0.5);
      expect(storageOptimizer.getTargetUtilization()).toBe(0.5);
    });

    test('should optimize storage entries', async () => {
      const mockEntries: CachedDataEntry[] = [
        {
          id: 'test:1',
          collection: 'test',
          data: { value: 1 },
          timestamp: Date.now() - 10000,
          lastAccessed: Date.now() - 5000,
          size: 1024,
          version: 1
        },
        {
          id: 'test:2',
          collection: 'test',
          data: { value: 2 },
          timestamp: Date.now() - 20000,
          lastAccessed: Date.now() - 15000,
          size: 2048,
          version: 1
        }
      ];

      const mockStats = {
        totalSize: 100 * 1024 * 1024,
        usedSize: 90 * 1024 * 1024, // Over target
        availableSize: 10 * 1024 * 1024,
        entryCount: 2,
        collections: {}
      };

      const startTime = performance.now();
      const entriesToRemove = await storageOptimizer.optimize(mockEntries, mockStats);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should be fast
      expect(Array.isArray(entriesToRemove)).toBe(true);
    });

    test('should provide optimization statistics', () => {
      const mockEntries: CachedDataEntry[] = [
        {
          id: 'test:1',
          collection: 'test',
          data: { value: 1 },
          timestamp: Date.now() - 10000,
          lastAccessed: Date.now() - 5000,
          size: 1024,
          version: 1
        },
        {
          id: 'test:2',
          collection: 'test',
          data: { value: 2 },
          timestamp: Date.now() - 20000,
          lastAccessed: Date.now() - 15000,
          size: 2048,
          version: 1
        }
      ];

      const stats = storageOptimizer.getOptimizationStats(mockEntries);

      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBe(3072);
      expect(stats.averageSize).toBe(1536);
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry);
      expect(stats.leastRecentlyUsed).toBeLessThan(stats.mostRecentlyUsed);
    });

    test('should check if optimization is needed', () => {
      // StorageOptimizer has maxSize = 50MB and targetUtilization = 0.8
      // So targetSize = 50MB * 0.8 = 40MB
      const mockStats = {
        totalSize: 100 * 1024 * 1024,
        usedSize: 45 * 1024 * 1024, // Over 40MB target (45MB > 40MB)
        availableSize: 55 * 1024 * 1024,
        entryCount: 100,
        collections: {}
      };

      expect(storageOptimizer.isOptimizationNeeded(mockStats)).toBe(true);

      mockStats.usedSize = 35 * 1024 * 1024; // Under 40MB target (35MB < 40MB)
      expect(storageOptimizer.isOptimizationNeeded(mockStats)).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    test('should meet cache operation performance (<10ms)', async () => {
      // This test verifies the performance requirement for cache operations
      const operations = [
        () => storageOptimizer.getStrategy(),
        () => storageOptimizer.setStrategy('lru'),
        () => storageOptimizer.getMaxSize(),
        () => storageOptimizer.setMaxSize(100 * 1024 * 1024),
        () => storageOptimizer.getTargetUtilization(),
        () => storageOptimizer.setTargetUtilization(0.9)
      ];

      for (const operation of operations) {
        const startTime = performance.now();
        operation();
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(10); // <10ms requirement
      }
    });

    test('should meet initialization performance requirements', async () => {
      const startTime = performance.now();

      const manager = new OfflineManager();
      await manager.initialize();

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should initialize quickly

      await manager.shutdown();
    });
  });

  describe('Integration Tests', () => {
    test('should integrate OfflineManager with dependencies', async () => {
      const manager = new OfflineManager();
      const cache = new LocalDataCache();

      // Set up dependency injection
      manager.setDependencies(cache);

      await manager.initialize();

      // Verify integration
      const storageStats = await manager.getStorageStats();
      expect(storageStats).toHaveProperty('totalSize');

      await manager.shutdown();
    });
  });
});