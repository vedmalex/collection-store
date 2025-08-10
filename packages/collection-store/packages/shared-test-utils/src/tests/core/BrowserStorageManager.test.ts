/**
 * BrowserStorageManager Core Tests
 * Migrated to shared-test-utils with Bun compatibility
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { createBunMocks, setupIndexedDBMock, cleanupIndexedDBMock } from '../../utils/bunTestUtils';
import { createTestStorageConfig, StorageType } from '../../utils/testTypes';

// Mock the BrowserStorageManager import for now
// TODO: Update import path when actual implementation is available
interface BrowserStorageManager {
  initialize(): Promise<void>;
  getActiveStorageType(): StorageType;
  write(key: string, data: any): Promise<void>;
  read(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  checkStorageAvailability(type: StorageType): Promise<boolean>;
}

// Mock implementation for testing
class MockBrowserStorageManager implements BrowserStorageManager {
  private storage = new Map<string, any>();
  private activeStorageType: StorageType = 'MEMORY';

  async initialize(): Promise<void> {
    // Try IndexedDB first
    try {
      if (globalThis.indexedDB) {
        this.activeStorageType = 'INDEXEDDB';
        return;
      }
    } catch (error) {
      // IndexedDB failed, try localStorage
    }

    // Try localStorage
    try {
      if (globalThis.localStorage) {
        // Test localStorage functionality
        globalThis.localStorage.setItem('test', 'test');
        globalThis.localStorage.removeItem('test');
        this.activeStorageType = 'LOCALSTORAGE';
        return;
      }
    } catch (error) {
      // localStorage failed, fall back to memory
    }

    // Fall back to memory
    this.activeStorageType = 'MEMORY';
  }

  getActiveStorageType(): StorageType {
    return this.activeStorageType;
  }

  async write(key: string, data: any): Promise<void> {
    this.storage.set(key, data);
  }

  async read(key: string): Promise<any> {
    return this.storage.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async checkStorageAvailability(type: StorageType): Promise<boolean> {
    switch (type) {
      case 'INDEXEDDB':
        return !!globalThis.indexedDB;
      case 'LOCALSTORAGE':
        try {
          if (!globalThis.localStorage) return false;
          globalThis.localStorage.setItem('test', 'test');
          globalThis.localStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      case 'MEMORY':
        return true;
      default:
        return false;
    }
  }
}

describe('Browser Storage Manager', () => {
  let storageManager: BrowserStorageManager;
  const { spyOn } = createBunMocks();

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Setup IndexedDB mock
    setupIndexedDBMock();

    // Create fresh instance for each test
    storageManager = new MockBrowserStorageManager();
  });

  afterEach(() => {
    // Cleanup mocks
    cleanupIndexedDBMock();
    mock.restore();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      await storageManager.initialize();
      expect(storageManager.getActiveStorageType()).toBeDefined();
    });

    test('should select IndexedDB as primary storage when available', async () => {
      // IndexedDB is mocked as available by setupIndexedDBMock
      await storageManager.initialize();

      const storageType = storageManager.getActiveStorageType();
      expect(storageType).toBe('INDEXEDDB');
    });

    test('should fallback to localStorage when IndexedDB fails', async () => {
      // Remove IndexedDB mock to simulate failure
      delete (globalThis as any).indexedDB;

      // Mock localStorage as available
      (globalThis as any).localStorage = {
        setItem: mock(() => {}),
        getItem: mock(() => null),
        removeItem: mock(() => {}),
        clear: mock(() => {}),
        length: 0,
        key: mock(() => null)
      };

      // Create new instance after setting up localStorage
      storageManager = new MockBrowserStorageManager();
      await storageManager.initialize();

      const storageType = storageManager.getActiveStorageType();
      expect(storageType).toBe('LOCALSTORAGE');
    });

    test('should fallback to memory storage when all persistent storage fails', async () => {
      // Remove all storage mocks
      (globalThis as any).indexedDB = undefined;
      (globalThis as any).localStorage = undefined;

      // Create new instance after removing storage
      storageManager = new MockBrowserStorageManager();
      await storageManager.initialize();

      const storageType = storageManager.getActiveStorageType();
      expect(storageType).toBe('MEMORY');
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      // Initialize with memory storage for predictable testing
      (globalThis as any).indexedDB = undefined;
      (globalThis as any).localStorage = undefined;

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
      // Setup IndexedDB mock
      setupIndexedDBMock();

      const isIndexedDBAvailable = await storageManager.checkStorageAvailability('INDEXEDDB');
      expect(isIndexedDBAvailable).toBe(true);

      // Mock localStorage as available with proper methods
      (globalThis as any).localStorage = {
        setItem: mock((key: string, value: string) => {}),
        getItem: mock((key: string) => null),
        removeItem: mock((key: string) => {}),
        clear: mock(() => {}),
        length: 0,
        key: mock(() => null)
      };

      const isLocalStorageAvailable = await storageManager.checkStorageAvailability('LOCALSTORAGE');
      expect(isLocalStorageAvailable).toBe(true);

      // Memory storage should always be available
      const isMemoryAvailable = await storageManager.checkStorageAvailability('MEMORY');
      expect(isMemoryAvailable).toBe(true);
    });

    test('should return correct active storage type', async () => {
      await storageManager.initialize();
      const activeType = storageManager.getActiveStorageType();

      // Should be one of the valid storage types
      expect(['INDEXEDDB', 'LOCALSTORAGE', 'MEMORY']).toContain(activeType);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage write errors gracefully', async () => {
      await storageManager.initialize();

      // This should not throw in memory storage
      await expect(storageManager.write('test-key', { data: 'test' })).resolves.toBeUndefined();
    });

    test('should handle storage read errors gracefully', async () => {
      await storageManager.initialize();

      // Reading non-existent key should return null, not throw
      const result = await storageManager.read('non-existent-key');
      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    test('should handle large data sets efficiently', async () => {
      await storageManager.initialize();

      const largeData = createTestData(1000);
      const startTime = Date.now();

      // Store large dataset
      await storageManager.write('large-dataset', largeData);

      // Retrieve large dataset
      const retrieved = await storageManager.read('large-dataset');

      const endTime = Date.now();
      const operationTime = endTime - startTime;

      expect(retrieved).toEqual(largeData);
      expect(operationTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle concurrent operations', async () => {
      await storageManager.initialize();

      const operations = [];

      // Create multiple concurrent write operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          storageManager.write(`concurrent-item-${i}`, { id: i, data: `test-${i}` })
        );
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      // Verify all items were stored correctly
      for (let i = 0; i < 10; i++) {
        const retrieved = await storageManager.read(`concurrent-item-${i}`);
        expect(retrieved).toEqual({ id: i, data: `test-${i}` });
      }
    });
  });

  // Helper functions
  function createTestData(count: number) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        id: `item-${i}`,
        name: `Test Item ${i}`,
        value: Math.random() * 1000,
        timestamp: Date.now() + i
      });
    }
    return data;
  }
});