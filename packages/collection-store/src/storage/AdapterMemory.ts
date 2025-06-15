import { IStorageAdapter } from './IGenericStorageAdapter';
import { v4 as uuidv4 } from 'uuid';
import { ITransactionResource } from '../transactions/interfaces/ITransactionResource';

interface DocumentWithId<T> extends Record<string, any> {
  _id: string;
}

export class AdapterMemory<T> implements IStorageAdapter<T>, ITransactionResource {
  private store: Map<string, T> = new Map();
  private transactions: Map<string, Map<string, T | null>> = new Map();
  private _tmTxToInternalTxMap = new Map<string, string>(); // Map TransactionManager's txId to AdapterMemory's internal txId

  // Collection-based storage: collection -> id -> document
  private collections: Map<string, Map<string, DocumentWithId<T>>> = new Map();
  private collectionTransactions: Map<string, Map<string, Map<string, DocumentWithId<T> | null>>> = new Map();

  async get(key: string, tmTxId?: string): Promise<T | null> {
    let internalTxId: string | undefined;
    if (tmTxId) {
      internalTxId = this._tmTxToInternalTxMap.get(tmTxId);
      if (!internalTxId) {
        // If TM txId is provided but no internal tx is mapped, it means prepareCommit was not called.
        // For read operations, we can fall back to the main store.
        return this.store.get(key) ?? null;
      }
    }

    if (internalTxId && this.transactions.has(internalTxId)) {
      const txStore = this.transactions.get(internalTxId)!;
      if (txStore.has(key)) {
        return txStore.get(key) ?? null;
      }
    }
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: T, tmTxId?: string): Promise<void> {
    let internalTxId: string | undefined;
    if (tmTxId) {
      internalTxId = this._tmTxToInternalTxMap.get(tmTxId);
      if (!internalTxId) {
        throw new Error(`Transaction with id ${tmTxId} not found. Call prepareCommit first.`);
      }
    }

    const targetStore = internalTxId ? this.transactions.get(internalTxId) : this.store;
    if (!targetStore) {
        // This case should ideally not happen if internalTxId is properly managed
        throw new Error(`Internal transaction store for id ${internalTxId} not found.`);
    }
    targetStore.set(key, value);
  }

  async delete(keyOrCollection: string, tmTxIdOrId?: string): Promise<void> {
    // If no second parameter, treat as key-value delete
    if (!tmTxIdOrId) {
      this.store.delete(keyOrCollection);
      return;
    }

    // Check if this is a collection operation by checking if the collection exists
    // and the second parameter doesn't look like a transaction ID
    const isCollectionOperation = this.collections.has(keyOrCollection) &&
      !this._tmTxToInternalTxMap.has(tmTxIdOrId) &&
      !this.transactions.has(tmTxIdOrId);

    if (isCollectionOperation) {
      // This is a collection delete operation (collection, id)
      const collection = keyOrCollection;
      const id = tmTxIdOrId;

      const collectionStore = this.collections.get(collection);
      if (!collectionStore) {
        return;
      }
      collectionStore.delete(id);
      return;
    }

    // Try to resolve as a TM txId
    let internalTxId: string | undefined;
    if (this._tmTxToInternalTxMap.has(tmTxIdOrId)) {
      internalTxId = this._tmTxToInternalTxMap.get(tmTxIdOrId)!;
    } else if (this.transactions.has(tmTxIdOrId)) {
      // It might be an internal txId directly passed (e.g., from AdapterMemory's own calls)
      internalTxId = tmTxIdOrId;
    }

    if (tmTxIdOrId && !internalTxId) {
      // If a tmTxId was provided but no internalTxId was resolved, it means prepareCommit wasn't called.
      throw new Error(`Transaction with id ${tmTxIdOrId} not found. Call prepareCommit first.`);
    }

    if (internalTxId) {
      const txStore = this.transactions.get(internalTxId)!;
      txStore.set(keyOrCollection, null); // Mark as deleted in transaction
      return;
    }

    // If we reach here, treat as key-value delete
    this.store.delete(keyOrCollection);
  }

  async keys(tmTxId?: string): Promise<string[]> {
    let internalTxId: string | undefined;
    if (tmTxId) {
      internalTxId = this._tmTxToInternalTxMap.get(tmTxId);
      if (!internalTxId) {
        // If TM txId is provided but no internal tx is mapped, we can't implicitly start a tx for reads.
        // Just proceed with main store or return null if no main store entry.
        return Array.from(this.store.keys());
      }
    }

    if(internalTxId) console.warn('keys() in a transaction is not fully supported and may yield inconsistent results.');
    return Array.from(this.store.keys());
  }

  async clear(tmTxId?: string): Promise<void> {
    let internalTxId: string | undefined;
    if (tmTxId) {
      internalTxId = this._tmTxToInternalTxMap.get(tmTxId);
      if (!internalTxId) {
        throw new Error(`Transaction with id ${tmTxId} not found. Call prepareCommit first.`);
      }
    }

    if(internalTxId){
        const txStore = this.transactions.get(internalTxId);
        if(!txStore) throw new Error(`Transaction with id ${internalTxId} not found.`);
        txStore.clear();
    } else {
        this.store.clear();
    }
  }

  // IStorageAdapter's beginTransaction method
  async beginTransaction(): Promise<string> {
    const txId = uuidv4();
    this.transactions.set(txId, new Map());
    this.collectionTransactions.set(txId, new Map());
    return txId;
  }

  // Unified commit method satisfying IStorageAdapter and used by ITransactionResource's finalizeCommit
  async commit(txId: string): Promise<void> {
    // Determine the actual internal txId to commit
    const internalTxId = this._tmTxToInternalTxMap.has(txId) ? this._tmTxToInternalTxMap.get(txId)! : txId;

    const txStore = this.transactions.get(internalTxId);
    if (!txStore) {
      throw new Error(`Transaction with id ${internalTxId} not found.`);
    }

    // Commit key-value store changes
    for (const [key, value] of txStore.entries()) {
      if (value === null) {
        this.store.delete(key);
      } else {
        this.store.set(key, value);
      }
    }

    // Commit collection changes
    const collectionTxStore = this.collectionTransactions.get(internalTxId);
    if (collectionTxStore) {
      for (const [collectionName, collectionChanges] of collectionTxStore.entries()) {
        if (!this.collections.has(collectionName)) {
          this.collections.set(collectionName, new Map());
        }
        const collection = this.collections.get(collectionName)!;

        for (const [docId, doc] of collectionChanges.entries()) {
          if (doc === null) {
            collection.delete(docId);
          } else {
            collection.set(docId, doc);
          }
        }
      }
    }

    this.transactions.delete(internalTxId);
    // Clean up mapping if it was a TM transaction
    if (this._tmTxToInternalTxMap.has(txId)) {
      this._tmTxToInternalTxMap.delete(txId);
    }
  }

  // Unified rollback method satisfying IStorageAdapter and ITransactionResource
  async rollback(txId: string): Promise<void> {
    // Determine the actual internal txId to rollback
    const internalTxId = this._tmTxToInternalTxMap.has(txId) ? this._tmTxToInternalTxMap.get(txId)! : txId;

    if (!this.transactions.has(internalTxId)) {
      console.warn(`Transaction with id ${internalTxId} not found during rollback. It might have already been cleaned up.`);
      // Clean up mapping if it was a TM transaction and still exists
      if (this._tmTxToInternalTxMap.has(txId)) {
        this._tmTxToInternalTxMap.delete(txId);
      }
      return; // Already rolled back or never started
    }

    this.transactions.delete(internalTxId);
    this.collectionTransactions.delete(internalTxId);

    // Clean up mapping if it was a TM transaction
    if (this._tmTxToInternalTxMap.has(txId)) {
      this._tmTxToInternalTxMap.delete(txId);
    }
  }

  // ITransactionResource specific methods
  async prepareCommit(tmTxId: string): Promise<boolean> {
    const internalTxId = await this.beginTransaction();
    this._tmTxToInternalTxMap.set(tmTxId, internalTxId);
    return true; // Memory adapter can always prepare
  }

  async finalizeCommit(tmTxId: string): Promise<void> {
    const internalTxId = this._tmTxToInternalTxMap.get(tmTxId);
    if (!internalTxId) {
      throw new Error(`Internal transaction for TM TxId ${tmTxId} not found during finalizeCommit.`);
    }
    await this.commit(internalTxId);
  }

  async init(): Promise<void> {
    // No-op for memory adapter
  }

  async create(collection: string, data: T): Promise<string> {
    const id = uuidv4();
    const document: DocumentWithId<T> = { ...data as any, _id: id };

    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map());
    }

    const collectionStore = this.collections.get(collection)!;
    collectionStore.set(id, document);

    return id;
  }

  async read(collection: string, id: string): Promise<T | null> {
    const collectionStore = this.collections.get(collection);
    if (!collectionStore) {
      return null;
    }

    const document = collectionStore.get(id);
    return document ? (document as any) : null;
  }

  async update(collection: string, id: string, data: T): Promise<void> {
    const collectionStore = this.collections.get(collection);
    if (!collectionStore) {
      // Silently ignore updates to non-existent collections/documents
      return;
    }

    const existingDocument = collectionStore.get(id);
    if (!existingDocument) {
      // Silently ignore updates to non-existent documents
      return;
    }

    const updatedDocument: DocumentWithId<T> = { ...data as any, _id: id };
    collectionStore.set(id, updatedDocument);
  }

  async find(collection: string, query: any): Promise<T[]> {
    const collectionStore = this.collections.get(collection);
    if (!collectionStore) {
      return [];
    }

    const documents = Array.from(collectionStore.values());

    // Simple query matching - check if all query properties match document properties
    const results = documents.filter(doc => {
      if (!query || Object.keys(query).length === 0) {
        return true; // Empty query matches all documents
      }

      return Object.entries(query).every(([key, value]) => {
        return (doc as any)[key] === value;
      });
    });

    return results as T[];
  }

  async close(): Promise<void> {
    // Clear all data on close as expected by tests
    this.store.clear();
    this.collections.clear();
    this.transactions.clear();
    this.collectionTransactions.clear();
  }
}