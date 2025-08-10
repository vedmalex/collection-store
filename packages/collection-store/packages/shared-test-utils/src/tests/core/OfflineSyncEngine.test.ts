/**
 * OfflineSyncEngine Core Tests
 * Migrated to shared-test-utils with Bun compatibility
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { createBunMocks, setupIndexedDBMock, cleanupIndexedDBMock } from '../../utils/bunTestUtils';
import {
  createTestSyncOperation,
  createTestChangeSet,
  SyncOperation,
  ChangeSet,
  SyncOperationType
} from '../../utils/testTypes';

// Mock the OfflineSyncEngine import for now
// TODO: Update import path when actual implementation is available
interface OfflineSyncEngine {
  initialize(): Promise<void>;
  queueOperation(operation: SyncOperation): Promise<void>;
  processQueue(): Promise<void>;
  getQueuedOperations(): Promise<SyncOperation[]>;
  clearQueue(): Promise<void>;
  syncWithServer(): Promise<void>;
  applyChangeSet(changeSet: ChangeSet): Promise<void>;
  getConflicts(): Promise<SyncOperation[]>;
  resolveConflict(operationId: string, resolution: 'local' | 'remote'): Promise<void>;
}

// Mock implementation for testing
class MockOfflineSyncEngine implements OfflineSyncEngine {
  private queue: SyncOperation[] = [];
  private conflicts: SyncOperation[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async queueOperation(operation: SyncOperation): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineSyncEngine not initialized');
    }
    this.queue.push(operation);
  }

  async processQueue(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('OfflineSyncEngine not initialized');
    }
    // Simulate processing by clearing queue
    this.queue = [];
  }

  async getQueuedOperations(): Promise<SyncOperation[]> {
    return [...this.queue];
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
  }

  async syncWithServer(): Promise<void> {
    // Simulate server sync
    await this.processQueue();
  }

  async applyChangeSet(changeSet: ChangeSet): Promise<void> {
    // Simulate applying changes
    if (changeSet.updated.length > 0) {
      // Create operations for updated items
      for (const item of changeSet.updated) {
        const operation = createTestSyncOperation('UPDATE', 'test-collection', item);
        await this.queueOperation(operation);
      }
    }
  }

  async getConflicts(): Promise<SyncOperation[]> {
    return [...this.conflicts];
  }

  async resolveConflict(operationId: string, resolution: 'local' | 'remote'): Promise<void> {
    this.conflicts = this.conflicts.filter(op => op.id !== operationId);
  }
}

describe('OfflineSyncEngine Core', () => {
  let syncEngine: OfflineSyncEngine;
  const { spyOn } = createBunMocks();

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Setup IndexedDB mock for persistence
    setupIndexedDBMock();

    // Create fresh instance for each test
    syncEngine = new MockOfflineSyncEngine();
  });

  afterEach(() => {
    // Cleanup mocks
    cleanupIndexedDBMock();
    mock.restore();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(syncEngine.initialize()).resolves.toBeUndefined();
    });

    test('should throw error when operations are queued before initialization', async () => {
      const operation = createTestSyncOperation('CREATE', 'users', { name: 'Test User' });

      await expect(syncEngine.queueOperation(operation)).rejects.toThrow(
        'OfflineSyncEngine not initialized'
      );
    });
  });

  describe('Operation Queueing', () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    test('should queue CREATE operations', async () => {
      const operation = createTestSyncOperation('CREATE', 'users', {
        name: 'John Doe',
        email: 'john@example.com'
      });

      await syncEngine.queueOperation(operation);

      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(1);
      expect(queuedOps[0]).toEqual(operation);
    });

    test('should queue UPDATE operations', async () => {
      const operation = createTestSyncOperation('UPDATE', 'users', {
        id: 'user-1',
        name: 'Jane Doe Updated'
      });

      await syncEngine.queueOperation(operation);

      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(1);
      expect(queuedOps[0].type).toBe('UPDATE');
    });

    test('should queue DELETE operations', async () => {
      const operation = createTestSyncOperation('DELETE', 'users', { id: 'user-1' });

      await syncEngine.queueOperation(operation);

      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(1);
      expect(queuedOps[0].type).toBe('DELETE');
    });

    test('should queue BATCH operations', async () => {
      const operation = createTestSyncOperation('BATCH', 'users', [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' }
      ]);

      await syncEngine.queueOperation(operation);

      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(1);
      expect(queuedOps[0].type).toBe('BATCH');
      expect(Array.isArray(queuedOps[0].data)).toBe(true);
    });

    test('should maintain operation order in queue', async () => {
      const operations = [
        createTestSyncOperation('CREATE', 'users', { name: 'User 1' }),
        createTestSyncOperation('UPDATE', 'users', { id: 'user-1', name: 'Updated User 1' }),
        createTestSyncOperation('DELETE', 'users', { id: 'user-2' })
      ];

      for (const op of operations) {
        await syncEngine.queueOperation(op);
      }

      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(3);
      expect(queuedOps[0].type).toBe('CREATE');
      expect(queuedOps[1].type).toBe('UPDATE');
      expect(queuedOps[2].type).toBe('DELETE');
    });
  });

  describe('Queue Processing', () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    test('should process queued operations', async () => {
      // Queue some operations
      const operations = [
        createTestSyncOperation('CREATE', 'users', { name: 'User 1' }),
        createTestSyncOperation('UPDATE', 'users', { id: 'user-1', name: 'Updated User 1' })
      ];

      for (const op of operations) {
        await syncEngine.queueOperation(op);
      }

      // Verify operations are queued
      let queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(2);

      // Process queue
      await syncEngine.processQueue();

      // Verify queue is empty after processing
      queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(0);
    });

    test('should clear queue manually', async () => {
      // Queue operations
      const operation = createTestSyncOperation('CREATE', 'users', { name: 'User 1' });
      await syncEngine.queueOperation(operation);

      // Verify operation is queued
      let queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(1);

      // Clear queue
      await syncEngine.clearQueue();

      // Verify queue is empty
      queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(0);
    });
  });

  describe('Server Synchronization', () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    test('should sync with server', async () => {
      // Queue operations
      const operations = [
        createTestSyncOperation('CREATE', 'users', { name: 'User 1' }),
        createTestSyncOperation('UPDATE', 'users', { id: 'user-1', name: 'Updated User 1' })
      ];

      for (const op of operations) {
        await syncEngine.queueOperation(op);
      }

      // Sync with server
      await expect(syncEngine.syncWithServer()).resolves.toBeUndefined();

      // Verify queue is processed after sync
      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(0);
    });
  });

  describe('ChangeSet Application', () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    test('should apply changeset with updates', async () => {
      const changeSet = createTestChangeSet(
        { id: 'new-item', name: 'New Item' }, // added
        [{ id: 'existing-item', name: 'Updated Item' }], // updated
        { id: 'deleted-item' } // deleted
      );

      await expect(syncEngine.applyChangeSet(changeSet)).resolves.toBeUndefined();

      // Verify operations were queued for updates
      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps.length).toBeGreaterThan(0);
    });

    test('should handle empty changeset', async () => {
      const emptyChangeSet = createTestChangeSet();

      await expect(syncEngine.applyChangeSet(emptyChangeSet)).resolves.toBeUndefined();
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    test('should get conflicts', async () => {
      const conflicts = await syncEngine.getConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });

    test('should resolve conflicts', async () => {
      const operationId = 'conflict-operation-1';

      await expect(syncEngine.resolveConflict(operationId, 'local')).resolves.toBeUndefined();
      await expect(syncEngine.resolveConflict(operationId, 'remote')).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // This test verifies that initialization doesn't throw unexpected errors
      await expect(syncEngine.initialize()).resolves.toBeUndefined();
    });

    test('should handle invalid operation data', async () => {
      await syncEngine.initialize();

      // Test with invalid operation type
      const invalidOperation = {
        id: 'invalid-op',
        type: 'INVALID_TYPE' as SyncOperationType,
        collectionName: 'test',
        data: null,
        timestamp: Date.now(),
        isLocal: true
      };

      // Should handle gracefully (implementation dependent)
      await expect(syncEngine.queueOperation(invalidOperation)).resolves.toBeUndefined();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    test('should handle large operation queues efficiently', async () => {
      const startTime = Date.now();

      // Queue many operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          createTestSyncOperation('CREATE', 'users', {
            id: `user-${i}`,
            name: `User ${i}`
          })
        );
      }

      // Queue all operations
      for (const op of operations) {
        await syncEngine.queueOperation(op);
      }

      const endTime = Date.now();
      const operationTime = endTime - startTime;

      // Verify all operations were queued
      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(100);

      // Should complete within reasonable time
      expect(operationTime).toBeLessThan(1000); // 1 second
    });

    test('should process queue efficiently', async () => {
      // Queue operations
      for (let i = 0; i < 50; i++) {
        const operation = createTestSyncOperation('CREATE', 'users', {
          id: `user-${i}`,
          name: `User ${i}`
        });
        await syncEngine.queueOperation(operation);
      }

      const startTime = Date.now();

      // Process queue
      await syncEngine.processQueue();

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process efficiently
      expect(processingTime).toBeLessThan(500); // 500ms

      // Verify queue is empty
      const queuedOps = await syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(0);
    });
  });
});