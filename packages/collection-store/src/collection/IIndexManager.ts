export interface IndexDefinition<T> {
  field: keyof T;
  unique: boolean;
}

export interface IIndexManager<T> {
  /**
   * Creates an index on a specific field.
   *
   * @param field The field to create the index on.
   * @param unique If true, the index will enforce unique values.
   */
  createIndex(field: keyof T, unique: boolean): Promise<void>;

  /**
   * Adds a value to the index for a specific document.
   *
   * @param field The indexed field.
   * @param value The value to add.
   * @param docId The ID of the document.
   * @param txId Optional transaction ID.
   */
  add(field: keyof T, value: any, docId: string, txId?: string): Promise<void>;

  /**
   * Removes a value from the index.
   *
   * @param field The indexed field.
   * @param value The value to remove.
   * @param docId The ID of the document.
   * @param txId Optional transaction ID.
   */
  remove(field: keyof T, value: any, docId: string, txId?: string): Promise<void>;

  /**
   * Finds document IDs by an indexed value.
   *
   * @param field The indexed field.
   * @param value The value to search for.
   * @returns An array of document IDs.
   */
  find(field: keyof T, value: any): Promise<string[]>;

  /**
   * Finds document IDs for a range of values.
   *
   * @param field The indexed field.
   * @param range The query range (e.g., { $gt: 10, $lt: 20 }).
   * @returns An array of document IDs.
   */
  findRange(field: keyof T, range: any): Promise<string[]>;

  // Transactional methods
  beginTransaction(): Promise<string>;
  commit(txId: string): Promise<void>;
  rollback(txId: string): Promise<void>;
}