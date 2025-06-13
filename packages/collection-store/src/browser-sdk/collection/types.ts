/**
 * Represents a generic collection item with a unique ID.
 */
export interface CollectionItem {
  id: string;
  [key: string]: any;
}

/**
 * Defines the options for a collection query.
 */
export interface CollectionQueryOptions {
  filter?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
}

/**
 * Defines the result of a collection query.
 */
export interface CollectionQueryResult<T extends CollectionItem = CollectionItem> {
  items: T[];
  totalCount: number;
  queryTime: number; // in ms
}