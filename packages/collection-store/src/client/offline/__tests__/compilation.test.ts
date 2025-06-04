/**
 * Phase 5.3: Offline-First Support - Compilation Test
 *
 * ✅ IDEA: Verify TypeScript compilation and basic functionality
 */

import { describe, test, expect } from 'bun:test';

describe('Phase 5.3 Day 1: Compilation Test', () => {
  test('should import types successfully', async () => {
    const {
      OfflineManager
    } = await import('../core/offline-manager');

    const {
      LocalDataCache
    } = await import('../core/local-data-cache');

    const {
      StorageOptimizer
    } = await import('../core/storage-optimizer');

    expect(OfflineManager).toBeDefined();
    expect(LocalDataCache).toBeDefined();
    expect(StorageOptimizer).toBeDefined();
  });

  test('should create instances successfully', () => {
    const { OfflineManager } = require('../core/offline-manager');
    const { LocalDataCache } = require('../core/local-data-cache');
    const { StorageOptimizer } = require('../core/storage-optimizer');

    const offlineManager = new OfflineManager();
    const localCache = new LocalDataCache();
    const storageOptimizer = new StorageOptimizer();

    expect(offlineManager).toBeInstanceOf(OfflineManager);
    expect(localCache).toBeInstanceOf(LocalDataCache);
    expect(storageOptimizer).toBeInstanceOf(StorageOptimizer);
  });

  test('should have correct default configurations', () => {
    const { OfflineManager } = require('../core/offline-manager');
    const { LocalDataCache } = require('../core/local-data-cache');
    const { StorageOptimizer } = require('../core/storage-optimizer');

    const offlineManager = new OfflineManager();
    const localCache = new LocalDataCache();
    const storageOptimizer = new StorageOptimizer();

    // Test OfflineManager defaults
    const offlineConfig = offlineManager.getConfig();
    expect(offlineConfig.enabled).toBe(true);
    expect(offlineConfig.maxStorageSize).toBe(50 * 1024 * 1024);

    // Test LocalDataCache defaults
    const cacheConfig = localCache.getConfig();
    expect(cacheConfig.maxSize).toBe(50 * 1024 * 1024);
    expect(cacheConfig.compressionEnabled).toBe(true);

    // Test StorageOptimizer defaults
    expect(storageOptimizer.getStrategy()).toBe('lru');
    expect(storageOptimizer.getMaxSize()).toBe(50 * 1024 * 1024);
    expect(storageOptimizer.getTargetUtilization()).toBe(0.8);
  });
});