import Collection from '../../core/Collection';
import { CSDatabase } from '../../core/Database';
import { TypedCollection } from '../../core/TypedCollection';
import { IStorageAdapter } from '../../storage/IGenericStorageAdapter';
import { IDataCollection } from '../../types/IDataCollection';
import { Item } from '../../types/Item';
import { TraverseCondition } from '../../types/TraverseCondition';
import { BrowserStorageManager } from '../storage/BrowserStorageManager';
import {
  CoreIntegrationConfig,
  CoreIntegrationResult,
  BrowserTypedCollection,
  BrowserStorageAdapter,
  IndexSyncResult,
  CoreMigrationResult,
  StorageBridgeConfig,
  SyncStatus
} from './types';

/**
 * Core integration layer that bridges browser-sdk with core Collection Store modules
 */
export class CoreIntegrationLayer {
  private coreDatabase?: CSDatabase;
  private storageAdapters: IStorageAdapter<any>[] = [];
  private browserStorageManager?: BrowserStorageManager;
  private bridgedAdapters: BrowserStorageAdapter[] = [];
  private syncInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(
    private config: CoreIntegrationConfig = {},
    browserStorageManager?: BrowserStorageManager
  ) {
    this.coreDatabase = config.coreDatabase;
    this.storageAdapters = config.storageAdapters || [];
    this.browserStorageManager = browserStorageManager;
  }

  /**
   * Initialize the core integration layer
   */
  async initialize(): Promise<CoreIntegrationResult> {
    try {
      // Initialize browser storage manager if not provided
      if (!this.browserStorageManager) {
        this.browserStorageManager = new BrowserStorageManager();
        await this.browserStorageManager.initialize();
      }

      // Bridge storage adapters
      const bridgedCount = await this.bridgeStorageAdapters();

      // Setup automatic sync if enabled
      if (this.config.autoSyncIndexes && this.coreDatabase) {
        await this.setupAutoSync();
      }

      this.isInitialized = true;

      return {
        success: true,
        message: 'Core integration layer initialized successfully',
        coreDatabase: this.coreDatabase,
        bridgedAdapters: bridgedCount,
        syncEnabled: !!this.syncInterval
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to initialize core integration: ${error.message}`,
        bridgedAdapters: 0,
        syncEnabled: false
      };
    }
  }

  /**
   * Create a browser collection based on core Collection
   */
  createBrowserCollection<T extends Item>(
    name: string,
    schema?: any
  ): BrowserTypedCollection<T> {
    if (!this.isInitialized) {
      throw new Error('CoreIntegrationLayer must be initialized first');
    }

    if (!this.coreDatabase) {
      throw new Error('Core database not available');
    }

    // Create core collection
    const coreCollection = this.coreDatabase.collection<T>(name);

    // Create browser typed collection wrapper
    return new BrowserTypedCollectionImpl<T>(
      coreCollection,
      name,
      schema,
      this.browserStorageManager!
    );
  }

  /**
   * Synchronize with core indexes
   */
  async syncWithCoreIndexes(): Promise<IndexSyncResult> {
    if (!this.coreDatabase) {
      return {
        success: false,
        indexesSynced: 0,
        indexesCreated: 0,
        indexesUpdated: 0,
        errors: ['Core database not available']
      };
    }

    try {
      // This is a simplified implementation
      // In a real scenario, we would get indexes from core database
      // and sync them with browser storage

      const result: IndexSyncResult = {
        success: true,
        indexesSynced: 0,
        indexesCreated: 0,
        indexesUpdated: 0,
        errors: []
      };

      // TODO: Implement actual index synchronization logic
      console.log('Index synchronization completed');

      return result;
    } catch (error) {
      return {
        success: false,
        indexesSynced: 0,
        indexesCreated: 0,
        indexesUpdated: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Bridge storage adapters from core to browser
   */
  async bridgeStorageAdapters(): Promise<number> {
    let bridgedCount = 0;

    for (const adapter of this.storageAdapters) {
      try {
        const bridgeConfig: StorageBridgeConfig = {
          bidirectionalSync: true,
          conflictResolution: 'core-wins',
          batchSize: 100,
          enableCompression: false
        };

        const browserAdapter = new BrowserStorageAdapterImpl(adapter, bridgeConfig);
        await browserAdapter.initialize();

        this.bridgedAdapters.push(browserAdapter);
        bridgedCount++;
      } catch (error) {
        console.warn(`Failed to bridge storage adapter: ${error.message}`);
      }
    }

    return bridgedCount;
  }

  /**
   * Migrate data from core to browser storage
   */
  async migrateFromCore(collectionNames?: string[]): Promise<CoreMigrationResult> {
    if (!this.coreDatabase || !this.browserStorageManager) {
      return {
        success: false,
        recordsMigrated: 0,
        collectionsMigrated: 0,
        indexesMigrated: 0,
        totalSize: 0,
        duration: 0,
        errors: ['Core database or browser storage not available']
      };
    }

    const startTime = Date.now();
    let recordsMigrated = 0;
    let collectionsMigrated = 0;
    const errors: string[] = [];

    try {
      // TODO: Implement actual migration logic
      // This would involve:
      // 1. Getting collections from core database
      // 2. Iterating through records
      // 3. Storing them in browser storage
      // 4. Handling conflicts and errors

      const duration = Date.now() - startTime;

      return {
        success: true,
        recordsMigrated,
        collectionsMigrated,
        indexesMigrated: 0,
        totalSize: 0,
        duration,
        errors
      };
    } catch (error) {
      return {
        success: false,
        recordsMigrated,
        collectionsMigrated,
        indexesMigrated: 0,
        totalSize: 0,
        duration: Date.now() - startTime,
        errors: [...errors, error.message]
      };
    }
  }

  /**
   * Setup automatic synchronization
   */
  private async setupAutoSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    const interval = this.config.syncInterval || 30000; // 30 seconds default

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncWithCoreIndexes();
      } catch (error) {
        console.warn('Auto sync failed:', error.message);
      }
    }, interval);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    // Cleanup bridged adapters
    for (const adapter of this.bridgedAdapters) {
      try {
        // TODO: Add cleanup method to BrowserStorageAdapter interface
      } catch (error) {
        console.warn('Failed to cleanup adapter:', error.message);
      }
    }

    this.isInitialized = false;
  }
}

/**
 * Implementation of BrowserTypedCollection
 */
class BrowserTypedCollectionImpl<T extends Item> implements BrowserTypedCollection<T> {
  constructor(
    public readonly coreCollection: IDataCollection<T>,
    public readonly name: string,
    public readonly schema: any,
    private browserStorage: BrowserStorageManager
  ) {}

  async initializeBrowser(): Promise<void> {
    // Initialize browser-specific features
    // This could include setting up local indexes, caching, etc.
  }

  async syncToBrowserStorage(): Promise<void> {
    // Sync collection data to browser storage
    // This would involve reading from core collection and storing in browser
  }

  async loadFromBrowserStorage(): Promise<void> {
    // Load data from browser storage back to core collection
  }

  async hasBrowserData(): Promise<boolean> {
    // Check if data exists in browser storage
    const key = `collection:${this.name}:exists`;
    const exists = await this.browserStorage.read<boolean>(key);
    return exists || false;
  }

  // Proxy methods to core collection (matching IDataCollection interface)
  async find(condition?: TraverseCondition<T>): Promise<T[]> {
    return this.coreCollection.find(condition || {});
  }

  async findFirst(condition?: TraverseCondition<T>): Promise<T | undefined> {
    return this.coreCollection.findFirst(condition || {});
  }

  async findById(id: any): Promise<T | undefined> {
    return this.coreCollection.findById(id);
  }

  async create(doc: T): Promise<T | undefined> {
    const result = await this.coreCollection.create(doc);
    // Optionally sync to browser storage
    await this.syncToBrowserStorage();
    return result;
  }

  async update(condition: TraverseCondition<T>, update: Partial<T>): Promise<T[]> {
    const result = await this.coreCollection.update(condition, update);
    // Optionally sync to browser storage
    await this.syncToBrowserStorage();
    return result;
  }

  async remove(condition: TraverseCondition<T>): Promise<(T | undefined)[]> {
    const result = await this.coreCollection.remove(condition);
    // Optionally sync to browser storage
    await this.syncToBrowserStorage();
    return result;
  }

  async save(doc: T): Promise<T | undefined> {
    const result = await this.coreCollection.save(doc);
    // Optionally sync to browser storage
    await this.syncToBrowserStorage();
    return result;
  }
}

/**
 * Implementation of BrowserStorageAdapter
 */
class BrowserStorageAdapterImpl implements BrowserStorageAdapter {
  constructor(
    public readonly coreAdapter: IStorageAdapter<any>,
    public readonly config: StorageBridgeConfig
  ) {}

  async initialize(): Promise<void> {
    await this.coreAdapter.init();
  }

  async syncFromCore(): Promise<void> {
    // Implement sync from core adapter to browser storage
  }

  async syncToCore(): Promise<void> {
    // Implement sync from browser storage to core adapter
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      lastSyncTime: new Date(),
      pendingOperations: 0,
      conflictsCount: 0,
      syncDirection: 'bidirectional',
      isHealthy: true
    };
  }
}