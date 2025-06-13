import { useContext, useSignal, useTask$ } from '@builder.io/qwik';
import { CollectionStoreContext } from '../QwikCollectionStoreContext';
import type { CollectionItem, CollectionQueryOptions, CollectionMutationOptions, CollectionQueryResult, CollectionMutationResult, CollectionStoreContextType } from '../types';

/**
 * A Qwik hook for interacting with a specific collection.
 * Provides methods to query, create, update, and delete items within a collection.
 * @param collectionName The name of the collection to interact with.
 */
export function useCollection<T extends CollectionItem = CollectionItem>(collectionName: string) {
  const sdkContext = useContext(CollectionStoreContext);

  // Initialize signals to hold the collection data and its state
  const items = useSignal<T[]>([]);
  const totalCount = useSignal(0);
  const queryTime = useSignal(0);

  const loading = useSignal(false);
  const error = useSignal<string | null>(null);

  // Function to query the collection
  const queryCollection = useTask$(async ({track}) => {
    track(() => sdkContext.browserCollectionManager);
    loading.value = true;
    error.value = null;
    try {
      const result = await sdkContext.browserCollectionManager.query(collectionName, {});
      items.value = result.items as T[];
      totalCount.value = result.totalCount;
      queryTime.value = result.queryTime;
    } catch (e: any) {
      console.error(`Error querying collection ${collectionName}:`, e);
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  });

  // Expose signals and methods for interacting with the collection
  return {
    items,
    totalCount,
    queryTime,
    loading,
    error,
    query: queryCollection,
    // Add more methods for create, update, delete as needed based on specific subtasks
  };
}