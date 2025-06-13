// src/browser-sdk/adapters/extjs/types.ts

import { BrowserStorageManager } from '../../storage/BrowserStorageManager';
import { OfflineSyncEngine } from '../../sync/OfflineSyncEngine';
import { ConfigLoader } from '../../config/ConfigLoader';
import { FeatureToggleManager } from'../../feature-toggles/FeatureToggleManager';
import { BrowserEventEmitter } from '../../events/BrowserEventEmitter';
import { BrowserCollectionManager } from '../../collection/BrowserCollectionManager';
import { CollectionItem, CollectionQueryOptions, CollectionQueryResult } from '../../collection/types';

/**
 * Defines the core context provided by the Collection Store ExtJS Provider.
 */
export interface CollectionStoreContextType {
  storageManager: BrowserStorageManager;
  syncEngine: OfflineSyncEngine;
  eventEmitter: BrowserEventEmitter;
  configLoader: ConfigLoader;
  featureToggleManager: FeatureToggleManager;
  browserCollectionManager: BrowserCollectionManager;
}

/**
 * Interface for an ExtJS Store proxy that interacts with Collection Store.
 */
export interface ICollectionStoreProxy {
  read(operation: any, callback: (success: boolean, records: CollectionItem[]) => void, scope: any): void;
  create(operation: any, callback: (success: boolean, records: CollectionItem[]) => void, scope: any): void;
  update(operation: any, callback: (success: boolean, records: CollectionItem[]) => void, scope: any): void;
  destroy(operation: any, callback: (success: boolean, records: CollectionItem[]) => void, scope: any): void;
}

/**
 * ExtJS Model definition type.
 */
export type ExtJSModel = any; // Ext.data.Model

/**
 * Configuration options for the Collection Store ExtJS integration.
 */
export interface ExtJSCollectionStoreConfig {
  collectionName: string;
  model: ExtJSModel; // The ExtJS model associated with this store
  proxy?: ICollectionStoreProxy; // Custom proxy if needed
}

// Re-export common types for convenience
export { CollectionItem, CollectionQueryOptions, CollectionQueryResult };
