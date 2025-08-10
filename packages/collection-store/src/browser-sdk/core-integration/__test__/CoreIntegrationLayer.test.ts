import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CoreIntegrationLayer } from '../CoreIntegrationLayer';
import { BrowserStorageManager } from '../../storage/BrowserStorageManager';
import { CoreIntegrationConfig } from '../types';
import { IStorageAdapter } from '../../../storage/IGenericStorageAdapter';
import { CSDatabase } from '../../../core/Database';
import { IDataCollection } from '../../../types/IDataCollection';
import { Item } from '../../../types/Item';

// Mock implementations for testing
class MockCSDatabase {
  private collections = new Map<string, MockCollection<any>>();

  collection<T extends Item>(name: string): IDataCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection<T>(name));
    }
    return this.collections.get(name) as IDataCollection<T>;
  }

  getCollections(): string[] {
    return Array.from(this.collections.keys());
  }
}

class MockCollection<T extends Item> implements IDataCollection<T> {
  private data = new Map<string, T>();
  private nextId = 1;

  constructor(public name: string) {}

  get config(): any {
    return { name: this.name };
  }

  get root(): string {
    return '/mock/root';
  }

  get ttl(): number | undefined {
    return undefined;
  }

  async reset(): Promise<void> {
    this.data.clear();
    this.nextId = 1;
  }

  async load(): Promise<void> {
    // Mock implementation
  }

  async persist(): Promise<void> {
    // Mock implementation
  }

  async push(item: T): Promise<T | undefined> {
    const id = this.nextId++;
    const itemWithId = { ...item, id: id.toString() } as T;
    this.data.set(id.toString(), itemWithId);
    return itemWithId;
  }

  async create(item: T): Promise<T | undefined> {
    return this.push(item);
  }

  async save(item: T): Promise<T | undefined> {
    if ('id' in item && item.id) {
      this.data.set(item.id.toString(), item);
      return item;
    }
    return this.create(item);
  }

  async first(): Promise<T | undefined> {
    return Array.from(this.data.values())[0];
  }

  async last(): Promise<T | undefined> {
    const values = Array.from(this.data.values());
    return values[values.length - 1];
  }

  async oldest(): Promise<T | undefined> {
    return this.first();
  }

  async latest(): Promise<T | undefined> {
    return this.last();
  }

  async lowest(): Promise<T | undefined> {
    return this.first();
  }

  async greatest(): Promise<T | undefined> {
    return this.last();
  }

  async find(condition: any = {}): Promise<T[]> {
    return Array.from(this.data.values());
  }

  async findFirst(condition: any = {}): Promise<T | undefined> {
    return this.first();
  }

  async findLast(condition: any = {}): Promise<T | undefined> {
    return this.last();
  }

  async findBy(): Promise<T[]> {
    return this.find();
  }

  async findFirstBy(): Promise<T | undefined> {
    return this.findFirst();
  }

  async findLastBy(): Promise<T | undefined> {
    return this.findLast();
  }

  async findById(id: any): Promise<T | undefined> {
    return this.data.get(id.toString());
  }

  async update(condition: any, update: Partial<T>): Promise<T[]> {
    const results: T[] = [];
    for (const [id, item] of this.data.entries()) {
      const updated = { ...item, ...update };
      this.data.set(id, updated);
      results.push(updated);
    }
    return results;
  }

  async updateFirst(condition: any, update: Partial<T>): Promise<T | undefined> {
    const results = await this.update(condition, update);
    return results[0];
  }

  async updateLast(condition: any, update: Partial<T>): Promise<T | undefined> {
    const results = await this.update(condition, update);
    return results[results.length - 1];
  }

  async updateWithId(id: any, update: Partial<T>): Promise<T | undefined> {
    const item = this.data.get(id.toString());
    if (item) {
      const updated = { ...item, ...update };
      this.data.set(id.toString(), updated);
      return updated;
    }
    return undefined;
  }

  async removeWithId(id: any): Promise<T | undefined> {
    const item = this.data.get(id.toString());
    if (item) {
      this.data.delete(id.toString());
      return item;
    }
    return undefined;
  }

  async remove(condition: any): Promise<(T | undefined)[]> {
    const results: (T | undefined)[] = [];
    for (const [id, item] of this.data.entries()) {
      this.data.delete(id);
      results.push(item);
    }
    return results;
  }

  async removeFirst(condition: any): Promise<T | undefined> {
    const results = await this.remove(condition);
    return results[0];
  }

  async removeLast(condition: any): Promise<T | undefined> {
    const results = await this.remove(condition);
    return results[results.length - 1];
  }

  listIndexes(): Array<{ name: string; key: { [key: string]: any } }> {
    return [];
  }

  dropIndex(): any {
    return true;
  }

  createIndex(): void {
    // Mock implementation
  }

  getData(): Map<string, T> {
    return new Map(this.data);
  }
}

class MockStorageAdapter implements IStorageAdapter<any> {
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
}

interface TestItem extends Item {
  id: string;
  name: string;
  value: number;
}

describe('Browser SDK Core Integration', () => {
  let coreIntegration: CoreIntegrationLayer;
  let mockDatabase: MockCSDatabase;
  let mockAdapter: MockStorageAdapter;
  let browserStorageManager: BrowserStorageManager;

  beforeEach(async () => {
    mockDatabase = new MockCSDatabase();
    mockAdapter = new MockStorageAdapter();
    browserStorageManager = new BrowserStorageManager();
    await browserStorageManager.initialize();
  });

  afterEach(async () => {
    if (coreIntegration) {
      await coreIntegration.cleanup();
    }
    await browserStorageManager.clear();
    await mockAdapter.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully with minimal config', async () => {
      const config: CoreIntegrationConfig = {};
      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);

      const result = await coreIntegration.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized successfully');
    });

    it('should initialize with core database and adapters', async () => {
      const config: CoreIntegrationConfig = {
        coreDatabase: mockDatabase as any,
        storageAdapters: [mockAdapter],
        autoSyncIndexes: true,
        syncInterval: 5000
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);

      const result = await coreIntegration.initialize();

      expect(result.success).toBe(true);
      expect(result.coreDatabase).toBe(mockDatabase);
      expect(result.bridgedAdapters).toBe(1);
      expect(result.syncEnabled).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Create a failing adapter
      const failingAdapter = new MockStorageAdapter();
      failingAdapter.init = async () => {
        throw new Error('Initialization failed');
      };

      const config: CoreIntegrationConfig = {
        storageAdapters: [failingAdapter]
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);

      const result = await coreIntegration.initialize();

      expect(result.success).toBe(true); // Should still succeed with partial failure
      expect(result.bridgedAdapters).toBe(0);
    });
  });

  describe('Browser Collection Creation', () => {
    beforeEach(async () => {
      const config: CoreIntegrationConfig = {
        coreDatabase: mockDatabase as any
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);
      await coreIntegration.initialize();
    });

    it('should create browser collection successfully', () => {
      const schema = { name: 'string', value: 'number' };
      const collection = coreIntegration.createBrowserCollection<TestItem>('test-collection', schema);

      expect(collection).toBeDefined();
      expect(collection.name).toBe('test-collection');
      expect(collection.schema).toEqual(schema);
      expect(collection.coreCollection).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      const uninitializedIntegration = new CoreIntegrationLayer();

      expect(() => {
        uninitializedIntegration.createBrowserCollection('test');
      }).toThrow('CoreIntegrationLayer must be initialized first');
    });

    it('should throw error when core database not available', async () => {
      const configWithoutDB: CoreIntegrationConfig = {};
      const integrationWithoutDB = new CoreIntegrationLayer(configWithoutDB, browserStorageManager);
      await integrationWithoutDB.initialize();

      expect(() => {
        integrationWithoutDB.createBrowserCollection('test');
      }).toThrow('Core database not available');

      await integrationWithoutDB.cleanup();
    });
  });

  describe('Browser Collection Operations', () => {
    let collection: any;

    beforeEach(async () => {
      const config: CoreIntegrationConfig = {
        coreDatabase: mockDatabase as any
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);
      await coreIntegration.initialize();

      collection = coreIntegration.createBrowserCollection<TestItem>('test-collection');
    });

    it('should perform CRUD operations', async () => {
      // Create
      const testItem: TestItem = { id: '1', name: 'test', value: 123 };
      const created = await collection.create(testItem);
      expect(created).toBeDefined();
      expect(created.name).toBe('test');

      // Read
      const found = await collection.findById('1');
      expect(found).toBeDefined();
      expect(found.name).toBe('test');

      // Update
      const updated = await collection.update({}, { value: 456 });
      expect(updated).toHaveLength(1);
      expect(updated[0].value).toBe(456);

      // Delete
      const removed = await collection.remove({});
      expect(removed).toHaveLength(1);
    });

    it('should handle browser-specific operations', async () => {
      await collection.initializeBrowser();

      const hasBrowserData = await collection.hasBrowserData();
      expect(typeof hasBrowserData).toBe('boolean');

      // These operations should not throw
      await collection.syncToBrowserStorage();
      await collection.loadFromBrowserStorage();
    });

    it('should find collections and items', async () => {
      const testItem: TestItem = { id: '1', name: 'test', value: 123 };
      await collection.create(testItem);

      const allItems = await collection.find();
      expect(allItems).toHaveLength(1);

      const firstItem = await collection.findFirst();
      expect(firstItem).toBeDefined();
      expect(firstItem.name).toBe('test');
    });
  });

  describe('Index Synchronization', () => {
    beforeEach(async () => {
      const config: CoreIntegrationConfig = {
        coreDatabase: mockDatabase as any,
        autoSyncIndexes: true
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);
      await coreIntegration.initialize();
    });

    it('should sync indexes successfully', async () => {
      const result = await coreIntegration.syncWithCoreIndexes();

      expect(result.success).toBe(true);
      expect(typeof result.indexesSynced).toBe('number');
      expect(typeof result.indexesCreated).toBe('number');
      expect(typeof result.indexesUpdated).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle sync failure when no database', async () => {
      const configWithoutDB: CoreIntegrationConfig = {};
      const integrationWithoutDB = new CoreIntegrationLayer(configWithoutDB, browserStorageManager);
      await integrationWithoutDB.initialize();

      const result = await integrationWithoutDB.syncWithCoreIndexes();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Core database not available');

      await integrationWithoutDB.cleanup();
    });
  });

  describe('Storage Adapter Bridging', () => {
    beforeEach(async () => {
      const config: CoreIntegrationConfig = {
        storageAdapters: [mockAdapter]
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);
      await coreIntegration.initialize();
    });

    it('should bridge storage adapters successfully', async () => {
      const bridgedCount = await coreIntegration.bridgeStorageAdapters();
      expect(bridgedCount).toBe(1);
    });

    it('should handle adapter bridging failures', async () => {
      const failingAdapter = new MockStorageAdapter();
      failingAdapter.init = async () => {
        throw new Error('Bridge failed');
      };

      const config: CoreIntegrationConfig = {
        storageAdapters: [failingAdapter]
      };

      const integrationWithFailingAdapter = new CoreIntegrationLayer(config, browserStorageManager);
      await integrationWithFailingAdapter.initialize();

      const bridgedCount = await integrationWithFailingAdapter.bridgeStorageAdapters();
      expect(bridgedCount).toBe(0);

      await integrationWithFailingAdapter.cleanup();
    });
  });

  describe('Data Migration', () => {
    beforeEach(async () => {
      const config: CoreIntegrationConfig = {
        coreDatabase: mockDatabase as any
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);
      await coreIntegration.initialize();
    });

    it('should migrate data from core successfully', async () => {
      const result = await coreIntegration.migrateFromCore(['test-collection']);

      expect(result.success).toBe(true);
      expect(typeof result.recordsMigrated).toBe('number');
      expect(typeof result.collectionsMigrated).toBe('number');
      expect(typeof result.duration).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle migration failure when no database', async () => {
      const configWithoutDB: CoreIntegrationConfig = {};
      const integrationWithoutDB = new CoreIntegrationLayer(configWithoutDB, browserStorageManager);
      await integrationWithoutDB.initialize();

      const result = await integrationWithoutDB.migrateFromCore();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Core database or browser storage not available');

      await integrationWithoutDB.cleanup();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      const config: CoreIntegrationConfig = {
        coreDatabase: mockDatabase as any,
        autoSyncIndexes: true,
        syncInterval: 1000
      };

      coreIntegration = new CoreIntegrationLayer(config, browserStorageManager);
      await coreIntegration.initialize();

      // Should not throw
      await coreIntegration.cleanup();
    });
  });
});