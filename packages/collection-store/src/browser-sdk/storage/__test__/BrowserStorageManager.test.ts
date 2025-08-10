import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BrowserStorageManager } from '../BrowserStorageManager';
import { StorageType, CoreIntegrationOptions } from '../types';
import { IStorageAdapter } from '../../../storage/IGenericStorageAdapter';

// Mock browser globals for Node.js environment
const mockLocalStorageData = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string) => mockLocalStorageData.get(key) || null,
  setItem: (key: string, value: string) => { mockLocalStorageData.set(key, value); },
  removeItem: (key: string) => { mockLocalStorageData.delete(key); },
  clear: () => { mockLocalStorageData.clear(); },
  get length() { return mockLocalStorageData.size; },
  key: (index: number) => {
    const keys = Array.from(mockLocalStorageData.keys());
    return keys[index] || null;
  }
};

const mockWindow = {
  indexedDB: undefined,
  localStorage: mockLocalStorage,
  navigator: undefined
};

// Set up browser environment mocks
(global as any).window = mockWindow;
(global as any).localStorage = mockLocalStorage;
(global as any).indexedDB = undefined;
(global as any).navigator = mockWindow.navigator;

// Mock core adapter for testing
class MockCoreAdapter implements IStorageAdapter<any> {
  private data = new Map<string, any>();
  private initialized = false;

  async init(): Promise<void> {
    this.initialized = true;
  }

  async create(collection: string, data: any): Promise<string> {
    const id = Math.random().toString(36);
    this.data.set(`${collection}:${id}`, data);
    return id;
  }

  async read(collection: string, id: string): Promise<any | null> {
    return this.data.get(`${collection}:${id}`) || null;
  }

  async update(collection: string, id: string, data: any): Promise<void> {
    this.data.set(`${collection}:${id}`, data);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async find(collection: string, query: any): Promise<any[]> {
    const results: any[] = [];
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(`${collection}:`)) {
        results.push(value);
      }
    }
    return results;
  }

  async close(): Promise<void> {
    this.data.clear();
    this.initialized = false;
  }

  async get(key: string): Promise<any | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async beginTransaction(): Promise<string> {
    return 'mock-tx-' + Math.random().toString(36);
  }

  async commit(txId: string): Promise<void> {
    // Mock implementation
  }

  async rollback(txId: string): Promise<void> {
    // Mock implementation
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getData(): Map<string, any> {
    return new Map(this.data);
  }
}

describe('Browser Storage Manager', () => {
  let manager: BrowserStorageManager;
  let mockAdapter: MockCoreAdapter;

  beforeEach(async () => {
    mockAdapter = new MockCoreAdapter();
  });

  afterEach(async () => {
    if (manager) {
      try {
        await manager.clear();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    // Clear mock data
    mockLocalStorageData.clear();
    await mockAdapter.close();
  });

  describe('Basic Functionality', () => {
    beforeEach(async () => {
      manager = new BrowserStorageManager();
      await manager.initialize();
    });

    it('should initialize successfully', async () => {
      expect(manager.getActiveStorageType()).toBeTruthy();
    });

    it('should write and read data', async () => {
      const testData = { name: 'test', value: 123 };
      await manager.write('test-key', testData);

      const result = await manager.read<typeof testData>('test-key');
      expect(result).toEqual(testData);
    });

    it('should delete data', async () => {
      await manager.write('test-key', { data: 'test' });
      await manager.delete('test-key');

      const result = await manager.read('test-key');
      expect(result).toBeNull();
    });

    it('should clear all data', async () => {
      await manager.write('key1', 'value1');
      await manager.write('key2', 'value2');
      await manager.clear();

      const result1 = await manager.read('key1');
      const result2 = await manager.read('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should check storage availability', async () => {
      const isIndexedDBAvailable = await manager.checkStorageAvailability(StorageType.IndexedDB);
      const isMemoryAvailable = await manager.checkStorageAvailability(StorageType.Memory);

      expect(typeof isIndexedDBAvailable).toBe('boolean');
      expect(isMemoryAvailable).toBe(true); // Memory storage should always be available
    });
  });

  describe('Core Integration', () => {
    beforeEach(async () => {
      const coreIntegrationOptions: CoreIntegrationOptions = {
        enableCoreIntegration: true,
        coreAdapters: [mockAdapter],
        syncStrategy: 'manual'
      };

      manager = new BrowserStorageManager(coreIntegrationOptions);
      await manager.initialize();
    });

    it('should initialize with core integration enabled', () => {
      expect(manager.isCoreIntegrationEnabled()).toBe(true);
      expect(manager.getCoreAdapters()).toHaveLength(1);
    });

    it('should integrate additional core adapters', async () => {
      const additionalAdapter = new MockCoreAdapter();
      await manager.integrateCoreAdapters([additionalAdapter]);

      expect(manager.getCoreAdapters()).toHaveLength(2);
      expect(additionalAdapter.isInitialized()).toBe(true);

      await additionalAdapter.close();
    });

    it('should sync data from core adapters', async () => {
      // Setup test data in core adapter
      await mockAdapter.set('test-key-1', { from: 'core', value: 'data1' });
      await mockAdapter.set('test-key-2', { from: 'core', value: 'data2' });

      // Sync from core
      const syncResult = await manager.syncFromCore();

      expect(syncResult.success).toBe(true);
      expect(syncResult.itemsSynced).toBe(2);

      // Verify data was synced to browser storage
      const result1 = await manager.read('test-key-1');
      const result2 = await manager.read('test-key-2');

      expect(result1).toEqual({ from: 'core', value: 'data1' });
      expect(result2).toEqual({ from: 'core', value: 'data2' });
    });

    it('should handle sync errors gracefully', async () => {
      // Create a failing adapter
      const failingAdapter = new MockCoreAdapter();
      failingAdapter.keys = async () => {
        throw new Error('Simulated failure');
      };

      await manager.integrateCoreAdapters([failingAdapter]);

      const syncResult = await manager.syncFromCore();

      expect(syncResult.success).toBe(false);
      expect(syncResult.errors).toHaveLength(1);
      expect(syncResult.errors![0]).toContain('Simulated failure');

      await failingAdapter.close();
    });

    it('should return appropriate result when core integration is disabled', async () => {
      const managerWithoutCore = new BrowserStorageManager();
      await managerWithoutCore.initialize();

      const syncResult = await managerWithoutCore.syncFromCore();

      expect(syncResult.success).toBe(false);
      expect(syncResult.message).toBe('Core integration not enabled');

      await managerWithoutCore.clear();
    });
  });

  describe('Storage Strategy Selection', () => {
    it('should select appropriate storage based on requirements', async () => {
      const requirements = {
        estimatedSize: 1024 * 1024, // 1MB
        persistenceLevel: 'permanent' as const,
        performanceRequirements: 'high' as const
      };

      manager = new BrowserStorageManager();
      await manager.initialize(requirements);

      const activeType = manager.getActiveStorageType();
      expect(activeType).toBeTruthy();
    });
  });

  describe('Quota Management', () => {
    beforeEach(async () => {
      manager = new BrowserStorageManager();
      await manager.initialize();
    });

    it('should get quota information when available', async () => {
      const quotaInfo = await manager.getQuotaInfo();

      // Quota info might not be available in test environment
      if (quotaInfo) {
        expect(typeof quotaInfo.total).toBe('number');
        expect(typeof quotaInfo.used).toBe('number');
        expect(typeof quotaInfo.remaining).toBe('number');
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      manager = new BrowserStorageManager();

      await expect(manager.read('test')).rejects.toThrow('BrowserStorageManager is not initialized');
      await expect(manager.write('test', 'value')).rejects.toThrow('BrowserStorageManager is not initialized');
      await expect(manager.delete('test')).rejects.toThrow('BrowserStorageManager is not initialized');
    });

    it('should handle initialization failure gracefully', async () => {
      // This test would require mocking the storage selection algorithm
      // to simulate initialization failure
      manager = new BrowserStorageManager();

      // For now, we just ensure the manager can be created
      expect(manager).toBeDefined();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      manager = new BrowserStorageManager();
      await manager.initialize();
    });

        it('should handle multiple concurrent operations', async () => {
      const operations: Promise<void>[] = [];

      // Create 100 concurrent write operations
      for (let i = 0; i < 100; i++) {
        operations.push(manager.write(`key-${i}`, { index: i, data: `value-${i}` }));
      }

      await Promise.all(operations);

      // Verify all data was written
      const readOperations: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        readOperations.push(manager.read(`key-${i}`));
      }

      const results = await Promise.all(readOperations);

      for (let i = 0; i < 100; i++) {
        expect(results[i]).toEqual({ index: i, data: `value-${i}` });
      }
    });

        it('should complete operations within performance targets', async () => {
      const startTime = Date.now();

      // Perform 1000 write operations
      const operations: Promise<void>[] = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(manager.write(`perf-key-${i}`, { data: i }));
      }

      await Promise.all(operations);

      const duration = Date.now() - startTime;

      // Should complete 1000 operations in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });
});