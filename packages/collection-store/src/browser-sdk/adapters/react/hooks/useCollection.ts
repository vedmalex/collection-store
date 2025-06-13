/// <reference lib="dom" />
// src/browser-sdk/adapters/react/hooks/useCollection.ts

import { useContext, useEffect, useState, useCallback } from 'react';
import { CollectionStoreContextType, CollectionItem, CollectionQueryOptions, CollectionQueryResult, CollectionMutationOptions, CollectionMutationResult } from '../types';
import { CollectionStoreContext } from '../CollectionStoreContext'; // Assuming a context file will be created

/**
 * A React hook for interacting with a specific collection.
 * Provides methods to query, create, update, and delete items within a collection.
 * @param collectionName The name of the collection to interact with.
 */
export function useCollection<T extends CollectionItem = CollectionItem>(collectionName: string) {
  const context = useContext(CollectionStoreContext);

  if (!context) {
    throw new Error('useCollection must be used within a CollectionStoreProvider');
  }

  const { storageManager, syncEngine, eventEmitter } = context;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to query items from the collection
  const queryCollection = useCallback(async (options?: CollectionQueryOptions): Promise<CollectionQueryResult<T>> => {
    setLoading(true);
    setError(null);
    try {
      const result = await storageManager.queryCollection<T>(collectionName, options);
      setItems(result.items);
      return result;
    } catch (e: any) {
      setError(e.message || 'Failed to query collection');
      return { items: [], totalCount: 0, queryTime: 0 };
    } finally {
      setLoading(false);
    }
  }, [collectionName, storageManager]);

  // Function to create a new item in the collection
  const createItem = useCallback(async (item: Omit<T, 'id'>, options?: CollectionMutationOptions): Promise<CollectionMutationResult<T>> => {
    try {
      const newItem = { ...item, id: Date.now().toString() } as T; // Simple ID generation for example
      const result = await storageManager.createItem(collectionName, newItem, options);
      // Optimistically update local state
      if (options?.optimisticUpdate) {
        setItems(prev => [...prev, result.item!]);
      }
      // If not optimistic, or if sync is immediate, re-query to ensure consistency
      if (!options?.optimisticUpdate || options?.syncImmediately) {
        await queryCollection(); // Re-query after successful creation/sync
      }
      return result;
    } catch (e: any) {
      setError(e.message || 'Failed to create item');
      return { success: false, error: e.message };
    }
  }, [collectionName, storageManager, queryCollection]);

  // Function to update an item in the collection
  const updateItem = useCallback(async (id: string, updates: Partial<T>, options?: CollectionMutationOptions): Promise<CollectionMutationResult<T>> => {
    try {
      const result = await storageManager.updateItem(collectionName, id, updates, options);
      // Optimistically update local state
      if (options?.optimisticUpdate) {
        setItems(prev => prev.map(item => (item.id === id ? { ...item, ...updates } as T : item)));
      }
      if (!options?.optimisticUpdate || options?.syncImmediately) {
        await queryCollection();
      }
      return result;
    } catch (e: any) {
      setError(e.message || 'Failed to update item');
      return { success: false, error: e.message };
    }
  }, [collectionName, storageManager, queryCollection]);

  // Function to delete an item from the collection
  const deleteItem = useCallback(async (id: string, options?: CollectionMutationOptions): Promise<CollectionMutationResult<T>> => {
    try {
      const result = await storageManager.deleteItem(collectionName, id, options);
      // Optimistically update local state
      if (options?.optimisticUpdate) {
        setItems(prev => prev.filter(item => item.id !== id));
      }
      if (!options?.optimisticUpdate || options?.syncImmediately) {
        await queryCollection();
      }
      return result;
    } catch (e: any) {
      setError(e.message || 'Failed to delete item');
      return { success: false, error: e.message };
    }
  }, [collectionName, storageManager, queryCollection]);

  // Initial data fetch and real-time updates
  useEffect(() => {
    queryCollection();

    // Subscribe to real-time updates for the collection
    const handleCollectionUpdate = (event: any) => {
      // Re-query or intelligently merge changes based on event payload
      queryCollection();
    };

    eventEmitter.on(`collection:${collectionName}:updated`, handleCollectionUpdate);

    return () => {
      eventEmitter.off(`collection:${collectionName}:updated`, handleCollectionUpdate);
    };
  }, [collectionName, queryCollection, eventEmitter]);

  return { items, loading, error, queryCollection, createItem, updateItem, deleteItem };
}