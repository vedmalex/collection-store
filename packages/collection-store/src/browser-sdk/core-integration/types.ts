import Collection from '../../core/Collection';
import { CSDatabase } from '../../core/Database';
import { TypedCollection } from '../../core/TypedCollection';
import { IStorageAdapter } from '../../storage/IGenericStorageAdapter';
import { IDataCollection } from '../../types/IDataCollection';
import { Item } from '../../types/Item';
import { TraverseCondition } from '../../types/TraverseCondition';

/**
 * Configuration for core integration layer
 */
export interface CoreIntegrationConfig {
  /** Core database instance to integrate with */
  coreDatabase?: CSDatabase;
  /** Storage adapters from core to bridge */
  storageAdapters?: IStorageAdapter<any>[];
  /** Enable automatic sync with core indexes */
  autoSyncIndexes?: boolean;
  /** Sync interval in milliseconds */
  syncInterval?: number;
}

/**
 * Result of core integration initialization
 */
export interface CoreIntegrationResult {
  success: boolean;
  message: string;
  coreDatabase?: CSDatabase;
  bridgedAdapters?: number;
  syncEnabled?: boolean;
}

/**
 * Browser-specific typed collection that wraps core TypedCollection
 */
export interface BrowserTypedCollection<T extends Item = any> {
  /** Underlying core collection */
  readonly coreCollection: IDataCollection<T>;
  /** Collection name */
  readonly name: string;
  /** Schema definition */
  readonly schema: any;

  // Browser-specific methods
  /** Initialize browser-specific features */
  initializeBrowser(): Promise<void>;
  /** Sync with browser storage */
  syncToBrowserStorage(): Promise<void>;
  /** Load from browser storage */
  loadFromBrowserStorage(): Promise<void>;
  /** Check if data exists in browser storage */
  hasBrowserData(): Promise<boolean>;

  // Proxy core collection methods (matching IDataCollection interface)
  find(condition?: TraverseCondition<T>): Promise<T[]>;
  findFirst(condition?: TraverseCondition<T>): Promise<T | undefined>;
  findById(id: any): Promise<T | undefined>;
  create(doc: T): Promise<T | undefined>;
  update(condition: TraverseCondition<T>, update: Partial<T>): Promise<T[]>;
  remove(condition: TraverseCondition<T>): Promise<(T | undefined)[]>;
  save(doc: T): Promise<T | undefined>;
}

/**
 * Storage bridge configuration
 */
export interface StorageBridgeConfig {
  /** Enable bidirectional sync */
  bidirectionalSync?: boolean;
  /** Conflict resolution strategy */
  conflictResolution?: 'core-wins' | 'browser-wins' | 'merge' | 'manual';
  /** Batch size for sync operations */
  batchSize?: number;
  /** Enable compression for large data */
  enableCompression?: boolean;
}

/**
 * Browser storage adapter that bridges core storage adapters
 */
export interface BrowserStorageAdapter {
  /** Original core adapter */
  readonly coreAdapter: IStorageAdapter<any>;
  /** Browser-specific configuration */
  readonly config: StorageBridgeConfig;

  /** Initialize browser bridge */
  initialize(): Promise<void>;
  /** Sync data from core to browser */
  syncFromCore(): Promise<void>;
  /** Sync data from browser to core */
  syncToCore(): Promise<void>;
  /** Check sync status */
  getSyncStatus(): Promise<SyncStatus>;
}

/**
 * Sync status information
 */
export interface SyncStatus {
  lastSyncTime: Date;
  pendingOperations: number;
  conflictsCount: number;
  syncDirection: 'core-to-browser' | 'browser-to-core' | 'bidirectional';
  isHealthy: boolean;
}

/**
 * Index sync result
 */
export interface IndexSyncResult {
  success: boolean;
  indexesSynced: number;
  indexesCreated: number;
  indexesUpdated: number;
  errors: string[];
}

/**
 * Migration result from core to browser
 */
export interface CoreMigrationResult {
  success: boolean;
  recordsMigrated: number;
  collectionsMigrated: number;
  indexesMigrated: number;
  totalSize: number;
  duration: number;
  errors: string[];
}