// React Adapter
export { useCollection as useReactCollection } from "./adapters/react/hooks/useCollection";
export { CollectionStoreProvider as ReactCollectionStoreProvider } from "./adapters/react/components/CollectionStoreProvider";

// Qwik Adapter
export { useCollection as useQwikCollection } from "./adapters/qwik/stores/useCollection";
export { CollectionStoreProvider as QwikCollectionStoreProvider } from "./adapters/qwik/components/CollectionStoreProvider";
export * from "./adapters/extjs/CollectionStore";
export * from "./adapters/extjs/components/CollectionGrid";
export * from "./performance/OperationTimingCollector";
export * from "./performance/MemoryUsageCollector";
export * from "./performance/NetworkPerformanceCollector";
export * from "./performance/UserInteractionCollector";
export * from "./performance/optimization/CacheOptimizer";
export * from "./performance/optimization/BatchOptimizer";
export * from "./performance/optimization/MemoryOptimizer";
export * from "./performance/optimization/NetworkOptimizer";
export * from "./testing/BrowserTestRunner";
export * from "./collection/BrowserCollectionManager";
export * from "./config/ConfigLoader";
export * from "./events/BrowserEventEmitter";
export * from "./sync/OfflineSyncEngine";
export * from "./feature-toggles/FeatureToggleManager";

// Core Integration Layer
export { CoreIntegrationLayer } from './core-integration/CoreIntegrationLayer';
export type {
  CoreIntegrationConfig,
  CoreIntegrationResult,
  BrowserTypedCollection,
  BrowserStorageAdapter,
  IndexSyncResult,
  CoreMigrationResult,
  StorageBridgeConfig,
  SyncStatus
} from './core-integration/types';

// Enhanced Browser Storage Manager with Core Integration
export { BrowserStorageManager } from './storage/BrowserStorageManager';
export type {
  StorageType,
  StorageRequirements,
  QuotaInfo,
  OptimizationResult,
  MigrationResult,
  SyncResult,
  CoreIntegrationOptions
} from './storage/types';

// Storage Strategies and Adapters
export type { StorageStrategy } from './storage/StorageStrategy';
export { StorageSelectionAlgorithm } from './storage/StorageSelectionAlgorithm';
export { IndexedDBStorage } from './storage/adapters/IndexedDBStorage';
export { LocalStorageStorage } from './storage/adapters/LocalStorageStorage';
export { MemoryStorage } from './storage/adapters/MemoryStorage';

/**
 * Browser SDK Core - Main entry point for browser-based Collection Store operations
 *
 * Features:
 * - Core Integration Layer for seamless integration with Collection Store core modules
 * - Enhanced Browser Storage Manager with core adapter support
 * - Multiple storage strategies (IndexedDB, LocalStorage, Memory)
 * - Automatic storage selection based on requirements
 * - Core data synchronization capabilities
 * - Performance monitoring and optimization
 *
 * Usage:
 * ```typescript
 * import { CoreIntegrationLayer, BrowserStorageManager } from '@collection-store/browser-sdk';
 *
 * // Initialize browser storage with core integration
 * const coreIntegrationOptions = {
 *   enableCoreIntegration: true,
 *   coreAdapters: [myAdapter],
 *   syncStrategy: 'automatic'
 * };
 *
 * const browserStorage = new BrowserStorageManager(coreIntegrationOptions);
 * await browserStorage.initialize();
 *
 * // Create core integration layer
 * const coreIntegration = new CoreIntegrationLayer({
 *   coreDatabase: myDatabase,
 *   storageAdapters: [myAdapter],
 *   autoSyncIndexes: true
 * }, browserStorage);
 *
 * await coreIntegration.initialize();
 *
 * // Create browser collection
 * const collection = coreIntegration.createBrowserCollection('users', userSchema);
 *
 * // Use collection with automatic core sync
 * const user = await collection.create({ name: 'John', email: 'john@example.com' });
 * ```
 */