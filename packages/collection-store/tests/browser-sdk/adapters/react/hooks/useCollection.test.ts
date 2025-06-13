import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, act } from '@testing-library/react-hooks';
import { useCollection } from '../../../src/browser-sdk/adapters/react/hooks/useCollection';
import { BrowserCollectionManager } from '../../../src/browser-sdk/collection/BrowserCollectionManager';
import { CollectionStoreContext } from '../../../src/browser-sdk/adapters/react/CollectionStoreContext';
import React from 'react';

// Mock BrowserCollectionManager
const mockBrowserCollectionManager = {
  read: mock(() => Promise.resolve({ id: '1', name: 'Test Item' })),
  write: mock(() => Promise.resolve()),
  subscribe: mock(() => () => {}),
  unsubscribe: mock(() => {}),
  query: mock(() => Promise.resolve([])),
  delete: mock(() => Promise.resolve())
} as unknown as BrowserCollectionManager;

describe('useCollection', () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  test('should initialize and fetch data if id is provided', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useCollection('testCollection', '1'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBeTrue();

    await waitForNextUpdate();

    expect(mockBrowserCollectionManager.read).toHaveBeenCalledWith('testCollection', '1');
    expect(result.current.data).toEqual({ id: '1', name: 'Test Item' });
    expect(result.current.isLoading).toBeFalse();
  });

  test('should not fetch data if id is not provided', () => {
    const { result } = renderHook(() => useCollection('testCollection'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    expect(mockBrowserCollectionManager.read).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBeFalse(); // Should not be loading if no fetch is initiated
  });

  test('should handle data updates via subscribe/unsubscribe', async () => {
    const subscribeHandler: { current: Function | undefined } = { current: undefined };
    mockBrowserCollectionManager.subscribe = mock((collectionName, handler) => {
      subscribeHandler.current = handler;
      return () => {};
    });

    const { result, rerender } = renderHook(() => useCollection('testCollection', '1'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    // Simulate initial data fetch
    act(() => {
      (mockBrowserCollectionManager.read as ReturnType<typeof mock>).mock.results[0].value = Promise.resolve({ id: '1', name: 'Initial Item' });
    });
    await act(async () => {}); // Await for promise to resolve

    expect(result.current.data).toEqual({ id: '1', name: 'Initial Item' });

    // Simulate data change through subscription
    act(() => {
      if (subscribeHandler.current) {
        subscribeHandler.current({ id: '1', name: 'Updated Item' });
      }
    });
    expect(result.current.data).toEqual({ id: '1', name: 'Updated Item' });

    expect(mockBrowserCollectionManager.subscribe).toHaveBeenCalledWith('testCollection', expect.any(Function));
    expect(mockBrowserCollectionManager.unsubscribe).not.toHaveBeenCalled(); // Should not unsubscribe until unmount
  });

  test('should handle write operations', async () => {
    const { result } = renderHook(() => useCollection('testCollection'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    const newItem = { id: '2', name: 'New Item' };
    await act(async () => {
      await result.current.write(newItem);
    });

    expect(mockBrowserCollectionManager.write).toHaveBeenCalledWith('testCollection', newItem.id, newItem);
  });

  test('should handle delete operations', async () => {
    const { result } = renderHook(() => useCollection('testCollection'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    await act(async () => {
      await result.current.remove('1');
    });

    expect(mockBrowserCollectionManager.delete).toHaveBeenCalledWith('testCollection', '1');
  });

  test('should handle query operations', async () => {
    mockBrowserCollectionManager.query = mock(() => Promise.resolve([{ id: 'q1' }]));

    const { result, waitForNextUpdate } = renderHook(() => useCollection('testCollection'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    let queryResult: any[] = [];
    await act(async () => {
      queryResult = await result.current.query({ name: 'test' });
    });

    expect(mockBrowserCollectionManager.query).toHaveBeenCalledWith('testCollection', { name: 'test' });
    expect(queryResult).toEqual([{ id: 'q1' }]);
  });

  test('should unsubscribe on unmount', () => {
    const unsubscribeSpy = mock(() => {});
    mockBrowserCollectionManager.subscribe = mock(() => unsubscribeSpy);

    const { unmount } = renderHook(() => useCollection('testCollection', '1'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    unmount();

    expect(unsubscribeSpy).toHaveBeenCalled();
  });

  test('should handle error during read operation', async () => {
    mockBrowserCollectionManager.read = mock(() => Promise.reject(new Error('Failed to read')));

    const { result, waitForNextUpdate } = renderHook(() => useCollection('testCollection', 'errorId'), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    await waitForNextUpdate();

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('Failed to read');
    expect(result.current.isLoading).toBeFalse();
  });

  test('should provide default state for collection name and id', () => {
    const { result } = renderHook(() => useCollection(), {
      wrapper: ({ children }) => (
        <CollectionStoreContext.Provider value={mockBrowserCollectionManager}>
          {children}
        </CollectionStoreContext.Provider>
      ),
    });

    expect(result.current.collectionName).toBeUndefined();
    expect(result.current.id).toBeUndefined();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBeFalse();
    expect(result.current.error).toBeUndefined();
  });
});