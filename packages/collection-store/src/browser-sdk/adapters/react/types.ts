import { BrowserEvent } from '../../events/types';
import { BrowserStorageManager } from '../../storage/BrowserStorageManager';
import { OfflineSyncEngine } from '../../sync/OfflineSyncEngine';
import { ConfigLoader } from '../../config/ConfigLoader';
import { FeatureToggleManager } from '../../feature-toggles/FeatureToggleManager';
import { BrowserEventEmitter } from '../../events/BrowserEventEmitter';
import { BrowserCollectionManager } from '../../collection/BrowserCollectionManager';

/**
 * Defines the core context provided by the Collection Store React Provider.
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
 * Represents a generic collection item with a unique ID.
 */
export interface CollectionItem {
  id: string;
  [key: string]: any;
}

/**
 * Defines the options for a collection query.
 */
export interface CollectionQueryOptions {
  filter?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
}

/**
 * Defines the result of a collection query.
 */
export interface CollectionQueryResult<T extends CollectionItem = CollectionItem> {
  items: T[];
  totalCount: number;
  queryTime: number; // in ms
}

/**
 * Defines the options for a mutation (create, update, delete) operation.
 */
export interface CollectionMutationOptions {
  syncImmediately?: boolean; // Whether to attempt immediate synchronization
  optimisticUpdate?: boolean; // Whether to apply changes optimistically to local state
}

/**
 * Defines the result of a collection mutation operation.
 */
export interface CollectionMutationResult<T extends CollectionItem = CollectionItem> {
  success: boolean;
  item?: T; // The affected item
  error?: string; // Error message if mutation failed
  isOptimistic?: boolean; // True if the update was optimistic
}

/**
 * Defines a subscription callback for real-time updates.
 */
export type CollectionSubscriptionHandler<T extends CollectionItem = CollectionItem> = (items: T[]) => void;