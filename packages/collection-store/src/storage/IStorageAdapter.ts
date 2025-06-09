export interface IStorageAdapter<T> {
  /**
   * Initializes the storage adapter.
   * This could involve connecting to a database or creating a directory.
   */
  init(): Promise<void>;

  /**
   * Creates a new record in the specified collection.
   *
   * @param collection The name of the collection.
   * @param data The data to be stored.
   * @returns The ID of the newly created record.
   */
  create(collection: string, data: T): Promise<string>;

  /**
   * Reads a record by its ID from the specified collection.
   *
   * @param collection The name of the collection.
   * @param id The ID of the record to retrieve.
   * @returns The record data, or null if not found.
   */
  read(collection: string, id: string): Promise<T | null>;

  /**
   * Updates an existing record by its ID in the specified collection.
   *
   * @param collection The name of the collection.
   * @param id The ID of the record to update.
   * @param data The new data for the record.
   */
  update(collection: string, id: string, data: T): Promise<void>;

  /**
   * Deletes a record by its ID from the specified collection.
   *
   * @param collection The name of the collection.
   * @param id The ID of the record to delete.
   */
  delete(key: string, txId?: string): Promise<void>;

  /**
   * Finds records in a collection that match a query.
   *
   * @param collection The name of the collection.
   * @param query The query object to match against.
   * @returns An array of matching records.
   */
  find(collection: string, query: any): Promise<T[]>;

  /**
   * Closes the connection or performs any cleanup.
   */
  close(): Promise<void>;

  get(key: string, txId?: string): Promise<T | null>;
  set(key: string, value: T, txId?: string): Promise<void>;
  keys(txId?: string): Promise<string[]>;
  clear(txId?: string): Promise<void>;

  // Transactional methods
  beginTransaction(): Promise<string>;
  commit(txId: string): Promise<void>;
  rollback(txId: string): Promise<void>;
}