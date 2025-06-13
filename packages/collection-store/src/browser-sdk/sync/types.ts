/**
 * Defines the types of operations that can be synchronized.
 */
export enum SyncOperationType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

/**
 * Represents a single synchronization operation to be queued or processed.
 */
export interface SyncOperation<T = any> {
  id: string; // Unique ID for the operation
  type: SyncOperationType;
  collectionName: string;
  data: T; // The data being created/updated/deleted
  timestamp: number; // When the operation was initiated locally
  isLocal: boolean; // True if initiated locally, false if from remote
}

/**
 * Represents a detected data conflict.
 */
export interface DataConflict<T = any> {
  collectionName: string;
  key: string; // The key of the conflicting item
  localData: T; // The local version of the data
  remoteData: T; // The remote version of the data
}

/**
 * Defines the result of a conflict resolution.
 */
export interface ResolutionResult<T = any> {
  success: boolean;
  message: string;
  resolvedData?: T; // The data after resolution
  conflict?: DataConflict<T>; // The original conflict if resolution failed
}

/**
 * Defines the result of processing the sync queue.
 */
export interface QueueProcessResult {
  success: boolean;
  message: string;
  operationsProcessed: number;
  errors: SyncOperation[]; // Operations that failed
  conflicts: DataConflict[]; // Conflicts detected during processing
}

/**
 * Callback function for network state changes.
 */
export type NetworkStateHandler = (isOnline: boolean) => void;

/**
 * Represents a set of changes for tracking.
 */
export interface ChangeSet<T = any> {
  created?: T[];
  updated?: T[];
  deleted?: string[]; // Array of keys for deleted items
  timestamp: number; // Timestamp of when these changes were recorded
}