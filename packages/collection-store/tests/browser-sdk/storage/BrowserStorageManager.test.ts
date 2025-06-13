// tests/browser-sdk/storage/BrowserStorageManager.test.ts

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { BrowserStorageManager } from '../../../src/browser-sdk/storage/BrowserStorageManager';
import { StorageType } from '../../../src/browser-sdk/storage/types';

describe('BrowserStorageManager', () => {
  let storageManager: BrowserStorageManager;

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Create fresh instance for each test
    storageManager = new BrowserStorageManager();
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      // Mock IndexedDB as available for initialization
      globalThis.indexedDB.open = mock(() => Promise.resolve({
        result: {
          createObjectStore: mock(),
          transaction: mock(),
          close: mock()
        }
      }));

      await storageManager.initialize();

      expect(storageManager.getActiveStorageType()).toBeDefined();
    });

    test('should select IndexedDB as primary storage when available', async () => {
      // Mock IndexedDB as available
      globalThis.indexedDB.open = mock(() => Promise.resolve({
        result: {
          createObjectStore: mock(),
          transaction: mock(),
          close: mock()
        }
      }));

      await storageManager.initialize();

      const storageType = storageManager.getActiveStorageType();
      expect(storageType).toBe(StorageType.IndexedDB);
    });

    test('should fallback to localStorage when IndexedDB fails', async () => {
      // Mock IndexedDB failure
      globalThis.indexedDB.open = mock(() => Promise.reject(new Error('IndexedDB not available')));

      // Mock localStorage as available
      globalThis.localStorage.setItem = mock(() => {});
      globalThis.localStorage.getItem = mock(() => null);

      await storageManager.initialize();

      const storageType = storageManager.getActiveStorageType();
      expect(storageType).toBe(StorageType.LocalStorage);
    });

    test('should fallback to memory storage when all persistent storage fails', async () => {
      // Mock all storage failures
      globalThis.indexedDB.open = mock(() => Promise.reject(new Error('IndexedDB not available')));
      globalThis.localStorage.setItem = mock(() => {
        throw new Error('localStorage not available');
      });

      await storageManager.initialize();

      const storageType = storageManager.getActiveStorageType();
      expect(storageType).toBe(StorageType.Memory);
    });

    test('should throw error if no storage strategy can be initialized', async () => {
      // Mock all storage types as unavailable
      globalThis.indexedDB.open = mock(() => Promise.reject(new Error('IndexedDB not available')));
      globalThis.localStorage.setItem = mock(() => {
        throw new Error('localStorage not available');
      });

      // Mock the selection algorithm to return null
      mock.spyOn(storageManager['storageSelectionAlgorithm'], 'selectOptimalStorage')
        .mockResolvedValueOnce(null);

      await expect(storageManager.initialize()).rejects.toThrow(
        'Failed to initialize BrowserStorageManager: No suitable storage strategy found.'
      );
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      // Initialize with memory storage for predictable testing
      globalThis.indexedDB.open = mock(() => Promise.reject(new Error('Force memory storage')));
      globalThis.localStorage.setItem = mock(() => {
        throw new Error('Force memory storage');
      });

      await storageManager.initialize();
    });

    test('should store and retrieve data', async () => {
      const testData = { id: '1', name: 'Test Item', value: 42 };

      // Store data
      await storageManager.write('test-item-1', testData);

      // Retrieve data
      const retrieved = await storageManager.read('test-item-1');

      expect(retrieved).toEqual(testData);
    });

    test('should handle multiple data types', async () => {
      const stringData = 'test string';
      const numberData = 42;
      const objectData = { id: 1, name: 'test' };
      const arrayData = [1, 2, 3, 'test'];

      // Store different data types
      await storageManager.write('string-key', stringData);
      await storageManager.write('number-key', numberData);
      await storageManager.write('object-key', objectData);
      await storageManager.write('array-key', arrayData);

      // Retrieve and verify
      expect(await storageManager.read('string-key')).toBe(stringData);
      expect(await storageManager.read('number-key')).toBe(numberData);
      expect(await storageManager.read('object-key')).toEqual(objectData);
      expect(await storageManager.read('array-key')).toEqual(arrayData);
    });

    test('should return null for non-existent keys', async () => {
      const result = await storageManager.read('non-existent-key');
      expect(result).toBeNull();
    });

    test('should delete items correctly', async () => {
      const testData = { id: '1', name: 'Test Item' };

      // Store and verify
      await storageManager.write('test-item', testData);
      let retrieved = await storageManager.read('test-item');
      expect(retrieved).toEqual(testData);

      // Delete and verify
      await storageManager.delete('test-item');
      retrieved = await storageManager.read('test-item');
      expect(retrieved).toBeNull();
    });

    test('should clear all data', async () => {
      // Store multiple items
      await storageManager.write('item-1', { id: '1' });
      await storageManager.write('item-2', { id: '2' });
      await storageManager.write('item-3', { id: '3' });

      // Verify items exist
      expect(await storageManager.read('item-1')).toEqual({ id: '1' });
      expect(await storageManager.read('item-2')).toEqual({ id: '2' });

      // Clear all data
      await storageManager.clear();

      // Verify all items are gone
      expect(await storageManager.read('item-1')).toBeNull();
      expect(await storageManager.read('item-2')).toBeNull();
      expect(await storageManager.read('item-3')).toBeNull();
    });
  });

  describe('Storage Type Detection', () => {
    test('should check storage availability correctly', async () => {
      // Mock IndexedDB as available
      globalThis.indexedDB.open = mock(() => Promise.resolve({
        result: { close: mock() }
      }));

      const isIndexedDBAvailable = await storageManager.checkStorageAvailability(StorageType.IndexedDB);
      expect(isIndexedDBAvailable).toBe(true);

      // Mock localStorage as available
      globalThis.localStorage.setItem = mock(() => {});

      const isLocalStorageAvailable = await storageManager.checkStorageAvailability(StorageType.LocalStorage);
      expect(isLocalStorageAvailable).toBe(true);

      // Memory storage should always be available
      const isMemoryAvailable = await storageManager.checkStorageAvailability(StorageType.Memory);
      expect(isMemoryAvailable).toBe(true);
    });

    test('should return correct active storage type', async () => {
      // Initialize with memory storage
      globalThis.indexedDB.open = mock(() => Promise.reject(new Error('IndexedDB not available')));
      globalThis.localStorage.setItem = mock(() => {
        throw new Error('localStorage not available');
      });

      await storageManager.initialize();

      expect(storageManager.getActiveStorageType()).toBe(StorageType.Memory);
    });
  });

  describe('Quota Management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should get quota information when available', async () => {
      // Mock navigator.storage.estimate
      mock.spyOn(globalThis.navigator.storage, 'estimate').mockResolvedValueOnce({
        quota: 1000000000, // 1GB
        usage: 50000000    // 50MB
      });

      const quotaInfo = await storageManager.getQuotaInfo();

      expect(quotaInfo).toEqual({
        total: 1000000000,
        used: 50000000,
        remaining: 950000000
      });
    });

    test('should handle quota estimation errors gracefully', async () => {
      // Mock navigator.storage.estimate to throw error
      mock.spyOn(globalThis.navigator.storage, 'estimate').mockRejectedValueOnce(new Error('Quota estimation failed'));

      const quotaInfo = await storageManager.getQuotaInfo();

      expect(quotaInfo).toBeNull();
    });

    test('should return null when storage estimation is not available', async () => {
      // Save original storage mock
      const originalStorageEstimate = globalThis.navigator.storage.estimate;

      // Remove storage estimation API by temporarily redefining navigator.storage
      Object.defineProperty(globalThis.navigator, 'storage', {
        value: {},
        configurable: true,
        writable: true
      });

      const quotaInfo = await storageManager.getQuotaInfo();

      expect(quotaInfo).toBeNull();

      // Restore for other tests
      Object.defineProperty(globalThis.navigator, 'storage', {
        value: { estimate: originalStorageEstimate },
        configurable: true,
        writable: true
      });
    });
  });

  // Performance benchmarks (assuming BrowserStorageManager handles internal performance logging)
  describe('Performance Benchmarks', () => {
    test('should perform write operations efficiently', async () => {
      await storageManager.initialize();

      const { averageTime } = await benchmarkOperation(async () => {
        await storageManager.write('perf-key-write', { value: 'test' });
      });

      expect(averageTime).toBeLessThan(100); // Expect write operations to be fast
    });

    test('should perform read operations efficiently', async () => {
      await storageManager.initialize();
      await storageManager.write('perf-key-read', { value: 'test' });

      const { averageTime } = await benchmarkOperation(async () => {
        await storageManager.read('perf-key-read');
      });

      expect(averageTime).toBeLessThan(50); // Expect read operations to be very fast
    });

    test('should perform delete operations efficiently', async () => {
      await storageManager.initialize();
      await storageManager.write('perf-key-delete', { value: 'test' });

      const { averageTime } = await benchmarkOperation(async () => {
        await storageManager.delete('perf-key-delete');
      });

      expect(averageTime).toBeLessThan(50); // Expect delete operations to be very fast
    });
  });

  // Utility functions
  function createTestData(count: number) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({ id: `item-${i}`, value: `data-${i}` });
    }
    return data;
  }

  async function benchmarkOperation(
    operation: () => Promise<void>,
    iterations: number = 10
  ): Promise<{ averageTime: number; totalTime: number }> {
    const times = [];
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const end = performance.now();
      const duration = end - start;
      times.push(duration);
      totalTime += duration;
    }

    const averageTime = totalTime / iterations;
    return { averageTime, totalTime };
  }
});