import { BrowserCollectionManager } from '../../collection/BrowserCollectionManager';
import { ExtJSCollectionStoreConfig, CollectionItem, CollectionQueryOptions } from './types';

/**
 * A custom ExtJS Store that integrates with the Collection Store SDK.
 * This store uses the BrowserCollectionManager for data operations.
 */
// This class would typically extend Ext.data.Store in a real ExtJS environment.
// For now, it will provide the core logic for data loading and management.
export class CollectionStore {
  private collectionName: string;
  private browserCollectionManager: BrowserCollectionManager;
  private data: CollectionItem[] = [];
  private totalCount: number = 0;
  private model: any; // Ext.data.Model in a real ExtJS app

  constructor(config: ExtJSCollectionStoreConfig, browserCollectionManager: BrowserCollectionManager) {
    this.collectionName = config.collectionName;
    this.model = config.model;
    this.browserCollectionManager = browserCollectionManager;
  }

  /**
   * Loads data into the store from the collection.
   * This method simulates the Ext.data.Store's load method.
   * @param options Optional load options, including filters, sorters, etc.
   * @param callback Callback function to be executed after loading.
   * @param scope Scope for the callback.
   */
  async load(options?: any, callback?: (records: CollectionItem[], operation: any, success: boolean) => void, scope?: any): Promise<void> {
    try {
      const queryOptions: CollectionQueryOptions = {
        filter: options?.filters ? this.extractFilters(options.filters) : undefined,
        sort: options?.sorters ? this.extractSorters(options.sorters) : undefined,
        limit: options?.limit,
        offset: options?.start,
      };

      const result = await this.browserCollectionManager.query(this.collectionName, queryOptions);
      this.data = result.items;
      this.totalCount = result.totalCount;

      if (callback) {
        callback.call(scope || this, this.data, options, true);
      }
    } catch (error: any) {
      console.error(`Failed to load collection ${this.collectionName}:`, error);
      if (callback) {
        callback.call(scope || this, [], options, false);
      }
    }
  }

  /**
   * Gets the total number of records in the store based on the last query.
   */
  getTotalCount(): number {
    return this.totalCount;
  }

  /**
   * Gets the records currently in the store.
   */
  getRange(): CollectionItem[] {
    return this.data;
  }

  /**
   * Gets the name of the collection managed by this store.
   */
  getCollectionName(): string {
    return this.collectionName;
  }

  // Helper to extract filters from ExtJS format to Collection Store format
  private extractFilters(extFilters: any[]): Record<string, any> {
    const filters: Record<string, any> = {};
    extFilters.forEach(f => {
      if (f.getProperty && f.getValue) {
        filters[f.getProperty()] = f.getValue();
      } else if (f.property && f.value) {
        filters[f.property] = f.value;
      }
    });
    return filters;
  }

  // Helper to extract sorters from ExtJS format to Collection Store format
  private extractSorters(extSorters: any[]): Record<string, 'asc' | 'desc'> {
    const sorters: Record<string, 'asc' | 'desc'> = {};
    extSorters.forEach(s => {
      if (s.getProperty && s.getDirection) {
        sorters[s.getProperty()] = s.getDirection().toLowerCase() as 'asc' | 'desc';
      } else if (s.property && s.direction) {
        sorters[s.property] = s.direction.toLowerCase() as 'asc' | 'desc';
      }
    });
    return sorters;
  }

  // TODO: Implement other store methods like add, remove, update, sync, etc.
}
