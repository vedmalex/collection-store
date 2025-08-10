/**
 * Shared Test Utilities for Collection Store V6.0
 * Provides common testing utilities across all packages
 */

// Export existing utilities
export * from './testHelpers';
export * from './mockData';
export * from './testUtils';

// Export new Bun test utilities
export * from './utils/bunTestUtils';
export * from './utils/testTypes';

// Re-export commonly used test functions
export {
  createBunMocks,
  setupIndexedDBMock,
  cleanupIndexedDBMock,
  createTestDataHelpers
} from './utils/bunTestUtils';

export {
  createTestSyncOperation,
  createTestChangeSet,
  createTestStorageConfig,
  createTestCollection,
  createTestDocument,
  createTestUser,
  createTestBatchOperation,
  createTestError,
  type SyncOperation,
  type ChangeSet,
  type StorageType,
  type SyncOperationType,
  type TestCollection,
  type TestDocument,
  type TestUser,
  type BatchOperation,
  type TestError
} from './utils/testTypes';

// Import utilities for default export
import {
  createBunMocks,
  setupIndexedDBMock,
  cleanupIndexedDBMock,
  createTestDataHelpers
} from './utils/bunTestUtils';

import {
  createTestSyncOperation,
  createTestChangeSet,
  createTestStorageConfig,
  createTestCollection,
  createTestDocument,
  createTestUser,
  createTestBatchOperation,
  createTestError
} from './utils/testTypes';

// Default export with all utilities
export default {
  // Bun utilities
  createBunMocks,
  setupIndexedDBMock,
  cleanupIndexedDBMock,
  createTestDataHelpers,

  // Type factories
  createTestSyncOperation,
  createTestChangeSet,
  createTestStorageConfig,
  createTestCollection,
  createTestDocument,
  createTestUser,
  createTestBatchOperation,
  createTestError
};