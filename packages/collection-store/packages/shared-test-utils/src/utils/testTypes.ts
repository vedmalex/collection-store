/**
 * Test Type Definitions and Helpers
 * Provides correct types for Browser SDK testing
 */

// Sync Operation Types
export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'BATCH';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  collectionName: string;
  data: any;
  timestamp: number;
  isLocal: boolean;
}

export interface ChangeSet {
  timestamp: number;
  added: any;
  updated: any[];
  deleted: any;
}

// Storage Types
export type StorageType = 'INDEXEDDB' | 'LOCALSTORAGE' | 'MEMORY';

export interface StorageConfig {
  type: StorageType;
  name: string;
  version?: number;
  options?: Record<string, any>;
}

// Collection Types
export interface CollectionSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

export interface CollectionOptions {
  timestamps?: boolean;
  validation?: boolean;
  indexes?: string[];
}

export interface TestCollection {
  name: string;
  schema: CollectionSchema;
  options: CollectionOptions;
}

// Test Data Factories
export const createTestSyncOperation = (
  type: SyncOperationType,
  collectionName: string,
  data: any,
  overrides: Partial<SyncOperation> = {}
): SyncOperation => ({
  id: `test-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  collectionName,
  data,
  timestamp: Date.now(),
  isLocal: true,
  ...overrides
});

export const createTestChangeSet = (
  added: any = {},
  updated: any[] = [],
  deleted: any = {},
  overrides: Partial<ChangeSet> = {}
): ChangeSet => ({
  timestamp: Date.now(),
  added,
  updated,
  deleted,
  ...overrides
});

export const createTestStorageConfig = (
  type: StorageType = 'INDEXEDDB',
  name: string = 'test-db',
  overrides: Partial<StorageConfig> = {}
): StorageConfig => ({
  type,
  name,
  version: 1,
  options: {},
  ...overrides
});

export const createTestCollectionSchema = (
  properties: Record<string, any> = {
    id: { type: 'string' },
    name: { type: 'string' }
  },
  overrides: Partial<CollectionSchema> = {}
): CollectionSchema => ({
  type: 'object',
  properties,
  required: ['id'],
  ...overrides
});

export const createTestCollectionOptions = (
  overrides: Partial<CollectionOptions> = {}
): CollectionOptions => ({
  timestamps: true,
  validation: true,
  indexes: ['id'],
  ...overrides
});

export const createTestCollection = (
  name: string = 'test-collection',
  overrides: Partial<TestCollection> = {}
): TestCollection => ({
  name,
  schema: createTestCollectionSchema(),
  options: createTestCollectionOptions(),
  ...overrides
});

// Test Document Types
export interface TestDocument {
  id: string;
  data: Record<string, any>;
  metadata?: {
    createdAt: string;
    updatedAt: string;
    version?: number;
  };
}

export const createTestDocument = (
  id: string = `test-doc-${Date.now()}`,
  data: Record<string, any> = { name: 'Test Document', value: 42 },
  overrides: Partial<TestDocument> = {}
): TestDocument => ({
  id,
  data,
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  },
  ...overrides
});

// Test User Types
export interface TestUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  preferences?: Record<string, any>;
}

export const createTestUser = (
  id: string = `test-user-${Date.now()}`,
  overrides: Partial<TestUser> = {}
): TestUser => ({
  id,
  name: `Test User ${id}`,
  email: `${id}@test.com`,
  createdAt: new Date().toISOString(),
  preferences: {},
  ...overrides
});

// Batch Operation Types
export interface BatchOperation {
  operations: SyncOperation[];
  transactionId: string;
  timestamp: number;
}

export const createTestBatchOperation = (
  operations: SyncOperation[] = [],
  overrides: Partial<BatchOperation> = {}
): BatchOperation => ({
  operations,
  transactionId: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  ...overrides
});

// Error Types for Testing
export interface TestError {
  code: string;
  message: string;
  details?: any;
}

export const createTestError = (
  code: string = 'TEST_ERROR',
  message: string = 'Test error occurred',
  details?: any
): TestError => ({
  code,
  message,
  details
});

// Export all types and factories
export default {
  createTestSyncOperation,
  createTestChangeSet,
  createTestStorageConfig,
  createTestCollectionSchema,
  createTestCollectionOptions,
  createTestCollection,
  createTestDocument,
  createTestUser,
  createTestBatchOperation,
  createTestError
};