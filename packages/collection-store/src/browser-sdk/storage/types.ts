/**
 * Defines the types of storage available.
 */
export enum StorageType {
  IndexedDB = 'IndexedDB',
  LocalStorage = 'LocalStorage',
  Memory = 'Memory',
}

/**
 * Defines the requirements for storage selection.
 */
export interface StorageRequirements {
  estimatedSize: number; // in bytes
  persistenceLevel: 'none' | 'session' | 'permanent';
  performanceRequirements: 'high' | 'medium' | 'low';
}

/**
 * Defines information about storage quota.
 */
export interface QuotaInfo {
  total: number; // in bytes
  used: number; // in bytes
  remaining: number; // in bytes
}

/**
 * Defines the result of a storage optimization.
 */
export interface OptimizationResult {
  optimized: boolean;
  message: string;
  bytesFreed?: number;
}

/**
 * Defines the result of a data migration.
 */
export interface MigrationResult {
  success: boolean;
  message: string;
  recordsMigrated?: number;
  errors?: string[];
}

/**
 * Defines the result of a storage synchronization.
 */
export interface SyncResult {
  success: boolean;
  message: string;
  conflictsResolved?: number;
  itemsSynced?: number;
  errors?: string[];
}