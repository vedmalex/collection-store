import { BrowserStorageManager } from '../storage/BrowserStorageManager';
import { CollectionItem, CollectionQueryOptions, CollectionQueryResult } from './types'; // Assuming types.ts will be in the same directory

/**
 * Manages operations on collections within the browser environment.
 * This class abstracts the underlying storage mechanism and provides collection-level functionalities.
 */
export class BrowserCollectionManager {
  private storageManager: BrowserStorageManager;

  constructor(storageManager: BrowserStorageManager) {
    this.storageManager = storageManager;
  }

  /**
   * Queries a specific collection.
   * @param collectionName The name of the collection to query.
   * @param options Query options (filter, sort, limit, offset).
   * @returns A promise that resolves with the query result.
   */
  async query<T extends CollectionItem>(collectionName: string, options: CollectionQueryOptions): Promise<CollectionQueryResult<T>> {
    // For simplicity, this initial implementation will just retrieve all items for the collection
    // and then apply filtering, sorting, and pagination in memory.
    // A more robust implementation would push these operations down to the storage layer if supported (e.g., IndexedDB).
    const allItems = await this.storageManager.read<T[]>(`collection_${collectionName}`) || [];

    let filteredItems = allItems;

    // Apply filter
    if (options.filter) {
      filteredItems = filteredItems.filter(item => {
        for (const key in options.filter) {
          if (item[key] !== options.filter[key]) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sort
    if (options.sort) {
      const sortKeys = Object.keys(options.sort);
      if (sortKeys.length > 0) {
        const sortBy = sortKeys[0]; // Only sort by the first key for simplicity
        const sortOrder = options.sort[sortBy];
        filteredItems.sort((a, b) => {
          const valA = a[sortBy];
          const valB = b[sortBy];
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    const totalCount = filteredItems.length;

    // Apply pagination
    const startIndex = options.offset || 0;
    const endIndex = (options.limit ? startIndex + options.limit : filteredItems.length);
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      totalCount,
      queryTime: 0, // Placeholder, actual query time calculation would be more complex
    };
  }

  // TODO: Add methods for add, update, delete operations on collections
}