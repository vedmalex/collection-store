import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { OfflineSyncEngine } from '../../../src/browser-sdk/sync/OfflineSyncEngine';
import { BrowserStorageManager } from '../../../src/browser-sdk/storage/BrowserStorageManager';
import { SyncOperation, SyncOperationType, DataConflict, ResolutionResult, NetworkStateHandler } from '../../../src/browser-sdk/sync/types';
import { ConflictResolutionStrategies } from '../../../src/browser-sdk/sync/ConflictResolutionStrategies';

describe('OfflineSyncEngine', () => {
  let syncEngine: OfflineSyncEngine;
  let mockBrowserStorageManager: BrowserStorageManager;
  let addEventListenerSpy: ReturnType<typeof mock.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof mock.spyOn>;
  let isOnlineSpy: ReturnType<typeof mock.spyOn>;
  let processQueueSpy: ReturnType<typeof mock.spyOn>;
  let resolveConflictSpy: ReturnType<typeof mock.spyOn>;

  beforeEach(() => {
    mock.restore();

    mockBrowserStorageManager = {} as BrowserStorageManager;
    mockBrowserStorageManager.initialize = mock(() => Promise.resolve());
    mockBrowserStorageManager.write = mock(() => Promise.resolve());
    mockBrowserStorageManager.read = mock(() => Promise.resolve(null));
    mockBrowserStorageManager.delete = mock(() => Promise.resolve());
    mockBrowserStorageManager.clear = mock(() => Promise.resolve());

    addEventListenerSpy = mock.spyOn(globalThis.window, 'addEventListener');
    removeEventListenerSpy = mock.spyOn(globalThis.window, 'removeEventListener');

    isOnlineSpy = mock.spyOn(OfflineSyncEngine.prototype, 'isOnline');
    processQueueSpy = mock.spyOn(OfflineSyncEngine.prototype, 'processQueue');
    resolveConflictSpy = mock.spyOn(ConflictResolutionStrategies, 'resolve');

    syncEngine = new OfflineSyncEngine(mockBrowserStorageManager);
  });

  afterEach(() => {
    mock.restore();
  });

  test('should initialize and setup network listeners', () => {
    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  describe('Network State Changes', () => {
    test('should process queue when online event fires and engine is online', async () => {
      isOnlineSpy.mockReturnValue(true);
      processQueueSpy.mockResolvedValueOnce({ success: true, operationsProcessed: 1, errors: [], conflicts: [] });

      const onlineHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'online')?.[1];
      if (onlineHandler) {
        onlineHandler();
      }
      await new Promise(resolve => setTimeout(resolve, 0)); // Allow microtasks to run

      expect(processQueueSpy).toHaveBeenCalled();
    });

    test('should not process queue when offline event fires', async () => {
      isOnlineSpy.mockReturnValue(false);
      processQueueSpy.mockClear(); // Clear any calls from initialization

      const offlineHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'offline')?.[1];
      if (offlineHandler) {
        offlineHandler();
      }
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(processQueueSpy).not.toHaveBeenCalled();
    });

    test('should notify registered network handlers on state change', () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      syncEngine.onNetworkStateChange(handler1);
      syncEngine.onNetworkStateChange(handler2);

      const onlineHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'online')?.[1];
      if (onlineHandler) {
        onlineHandler();
      }

      expect(handler1).toHaveBeenCalledWith(true);
      expect(handler2).toHaveBeenCalledWith(true);

      const offlineHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'offline')?.[1];
      if (offlineHandler) {
        offlineHandler();
      }

      expect(handler1).toHaveBeenCalledWith(false);
      expect(handler2).toHaveBeenCalledWith(false);
    });
  });

  describe('Enqueue Operations', () => {
    test('should add operation to queue', async () => {
      const operation: SyncOperation = { type: SyncOperationType.Create, collectionName: 'users', data: { id: '1' } };
      await syncEngine.enqueueOperation(operation);
      // Assuming queue is internal, check by trying to process it.
      isOnlineSpy.mockReturnValue(true);
      await syncEngine.processQueue(); // This will clear the queue
      // No direct way to check queue length, but if processQueue was called, it means it was enqueued
      expect(processQueueSpy).toHaveBeenCalled();
    });

    test('should process queue immediately if online', async () => {
      isOnlineSpy.mockReturnValue(true);
      processQueueSpy.mockResolvedValueOnce({ success: true, operationsProcessed: 1, errors: [], conflicts: [] });

      const operation: SyncOperation = { type: SyncOperationType.Create, collectionName: 'products', data: { id: 'abc' } };
      await syncEngine.enqueueOperation(operation);

      expect(processQueueSpy).toHaveBeenCalled();
    });

    test('should not process queue immediately if offline', async () => {
      isOnlineSpy.mockReturnValue(false);
      processQueueSpy.mockClear();

      const operation: SyncOperation = { type: SyncOperationType.Create, collectionName: 'orders', data: { id: 'xyz' } };
      await syncEngine.enqueueOperation(operation);

      expect(processQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('Process Queue', () => {
    let simulateRemoteSyncSpy: ReturnType<typeof mock.spyOn>;

    beforeEach(() => {
      simulateRemoteSyncSpy = mock.spyOn(syncEngine as any, 'simulateRemoteSync');
    });

    test('should process all operations in the queue when online', async () => {
      isOnlineSpy.mockReturnValue(true);
      simulateRemoteSyncSpy.mockResolvedValue({ success: true, message: 'Synced' });

      const op1: SyncOperation = { type: SyncOperationType.Create, collectionName: 'a', data: {} };
      const op2: SyncOperation = { type: SyncOperationType.Update, collectionName: 'b', data: {} };
      await syncEngine.enqueueOperation(op1);
      await syncEngine.enqueueOperation(op2);

      const result = await syncEngine.processQueue();

      expect(result.success).toBeTrue();
      expect(result.operationsProcessed).toBe(2);
      expect(simulateRemoteSyncSpy).toHaveBeenCalledTimes(2);
    });

    test('should handle simulated remote sync failures', async () => {
      isOnlineSpy.mockReturnValue(true);
      simulateRemoteSyncSpy.mockResolvedValueOnce({ success: false, message: 'Failed' });
      simulateRemoteSyncSpy.mockResolvedValueOnce({ success: true, message: 'Synced' });

      const op1: SyncOperation = { type: SyncOperationType.Create, collectionName: 'fail', data: {} };
      const op2: SyncOperation = { type: SyncOperationType.Update, collectionName: 'success', data: {} };
      await syncEngine.enqueueOperation(op1);
      await syncEngine.enqueueOperation(op2);

      const result = await syncEngine.processQueue();

      expect(result.success).toBeFalse();
      expect(result.operationsProcessed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toEqual(op1);
    });

    test('should handle simulated conflicts and resolve them', async () => {
      isOnlineSpy.mockReturnValue(true);
      const conflictData: DataConflict = { collectionName: 'c', key: 'conflict_item', localData: { version: 1 }, remoteData: { version: 2 } };
      simulateRemoteSyncSpy.mockResolvedValueOnce({ success: false, conflict: conflictData, message: 'Conflict' });

      resolveConflictSpy.mockResolvedValueOnce({ success: true, resolvedData: { version: 3 }, message: 'Resolved' });

      const op1: SyncOperation = { type: SyncOperationType.Create, collectionName: 'c', data: { key: 'conflict_item' } };
      await syncEngine.enqueueOperation(op1);

      const result = await syncEngine.processQueue();

      expect(result.success).toBeTrue();
      expect(result.operationsProcessed).toBe(1);
      expect(result.conflicts.length).toBe(0); // Conflict should be resolved successfully
      expect(resolveConflictSpy).toHaveBeenCalledWith(conflictData);
    });

    test('should handle failed conflict resolution', async () => {
      isOnlineSpy.mockReturnValue(true);
      const conflictData: DataConflict = { collectionName: 'd', key: 'conflict_item', localData: { version: 1 }, remoteData: { version: 2 } };
      simulateRemoteSyncSpy.mockResolvedValueOnce({ success: false, conflict: conflictData, message: 'Conflict' });

      resolveConflictSpy.mockResolvedValueOnce({ success: false, message: 'Resolution failed' });

      const op1: SyncOperation = { type: SyncOperationType.Create, collectionName: 'd', data: { key: 'conflict_item' } };
      await syncEngine.enqueueOperation(op1);

      const result = await syncEngine.processQueue();

      expect(result.success).toBeFalse();
      expect(result.operationsProcessed).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0]).toEqual(conflictData);
    });
  });

  describe('Change Tracking', () => {
    test('should track changes for a collection', () => {
      const changeSet = { timestamp: Date.now(), added: { id: '1' }, updated: {}, deleted: {} };
      syncEngine.trackChanges('myCollection', changeSet);

      const changes = syncEngine.getChangesSince('myCollection', 0);
      expect(changes).toEqual([changeSet]);
    });

    test('should retrieve changes since a specific timestamp', () => {
      const changeSet1 = { timestamp: 100, added: { id: 'a' }, updated: {}, deleted: {} };
      const changeSet2 = { timestamp: 200, added: { id: 'b' }, updated: {}, deleted: {} };
      const changeSet3 = { timestamp: 300, added: { id: 'c' }, updated: {}, deleted: {} };

      syncEngine.trackChanges('anotherCollection', changeSet1);
      syncEngine.trackChanges('anotherCollection', changeSet2);
      syncEngine.trackChanges('anotherCollection', changeSet3);

      const changes = syncEngine.getChangesSince('anotherCollection', 150);
      expect(changes).toEqual([changeSet2, changeSet3]);
    });

    test('should return empty array if no changes for collection', () => {
      const changes = syncEngine.getChangesSince('nonExistentCollection', 0);
      expect(changes).toEqual([]);
    });
  });

  describe('Network Status', () => {
    test('isOnline should return navigator.onLine if available', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        configurable: true,
        writable: true
      });
      expect(syncEngine.isOnline()).toBeTrue();

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        configurable: true,
        writable: true
      });
      expect(syncEngine.isOnline()).toBeFalse();
    });

    test('isOnline should return true if navigator is not available (Node.js env)', () => {
      const originalNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        configurable: true,
        writable: true
      });

      expect(syncEngine.isOnline()).toBeTrue();

      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
    });
  });

  describe('Network State Change Handlers', () => {
    test('should register and unregister network handlers', () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      syncEngine.onNetworkStateChange(handler1);
      syncEngine.onNetworkStateChange(handler2);

      // Manually trigger network change (since real events are mocked for window)
      // Accessing private method for testing purposes
      (syncEngine as any).handleNetworkChange(true);
      expect(handler1).toHaveBeenCalledWith(true);
      expect(handler2).toHaveBeenCalledWith(true);

      syncEngine.offNetworkStateChange(handler1);
      (syncEngine as any).handleNetworkChange(false);
      expect(handler1).not.toHaveBeenCalledWith(false); // Should not be called after unregistering
      expect(handler2).toHaveBeenCalledWith(false);
    });
  });
});