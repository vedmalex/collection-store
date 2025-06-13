import { IStorageAdapter } from './IStorageAdapter';
import { v4 as uuidv4 } from 'uuid';

interface DocumentWithId<T> extends Record<string, any> {
  _id: string;
}

export class AdapterMemory<T> implements IStorageAdapter<T> {
  private store: Map<string, T> = new Map();
  private transactions: Map<string, Map<string, T | null>> = new Map();

  // Collection-based storage: collection -> id -> document
  private collections: Map<string, Map<string, DocumentWithId<T>>> = new Map();
  private collectionTransactions: Map<string, Map<string, Map<string, DocumentWithId<T> | null>>> = new Map();

  async get(key: string, txId?: string): Promise<T | null> {
    if (txId && this.transactions.has(txId)) {
      const txStore = this.transactions.get(txId)!;
      if (txStore.has(key)) {
        return txStore.get(key) ?? null;
      }
    }
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: T, txId?: string): Promise<void> {
    const targetStore = txId ? this.transactions.get(txId) : this.store;
    if (!targetStore) {
        if(txId) throw new Error(`Transaction with id ${txId} not found.`);
        return;
    }
    targetStore.set(key, value);
  }

  async delete(key: string, txId?: string): Promise<void>;
  async delete(collection: string, id: string): Promise<void>;
  async delete(keyOrCollection: string, txIdOrId?: string): Promise<void> {
    // If no second parameter, treat as key-value delete
    if (!txIdOrId) {
      this.store.delete(keyOrCollection);
      return;
    }

    // Check if we have an active transaction with this ID
    if (this.transactions.has(txIdOrId)) {
      // This is a transaction ID, treat as key-value delete
      const txStore = this.transactions.get(txIdOrId)!;
      txStore.set(keyOrCollection, null); // Mark as deleted in transaction
      return;
    }

    // Otherwise, treat as collection delete (collection, id)
    const collection = keyOrCollection;
    const id = txIdOrId;

    const collectionStore = this.collections.get(collection);
    if (!collectionStore) {
      // Silently ignore deletes from non-existent collections
      return;
    }

    collectionStore.delete(id);
  }

  async keys(txId?: string): Promise<string[]> {
    // This is a simplification. A real implementation would need to merge
    // keys from the main store and the transaction store.
    if(txId) console.warn('keys() in a transaction is not fully supported and may yield inconsistent results.');
    return Array.from(this.store.keys());
  }

  async clear(txId?: string): Promise<void> {
    if(txId){
        const txStore = this.transactions.get(txId);
        if(!txStore) throw new Error(`Transaction with id ${txId} not found.`);
        txStore.clear(); // This might not be what we want. Needs careful thought.
                         // For now, it clears the transaction context.
    } else {
        this.store.clear();
    }
  }

  async beginTransaction(): Promise<string> {
    const txId = uuidv4();
    this.transactions.set(txId, new Map());
    this.collectionTransactions.set(txId, new Map());
    return txId;
  }

  async commit(txId: string): Promise<void> {
    const txStore = this.transactions.get(txId);
    if (!txStore) {
      throw new Error(`Transaction with id ${txId} not found.`);
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
    const collectionTxStore = this.collectionTransactions.get(txId);
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

    this.transactions.delete(txId);
    this.collectionTransactions.delete(txId);
  }

  async rollback(txId: string): Promise<void> {
    if (!this.transactions.has(txId)) {
      throw new Error(`Transaction with id ${txId} not found.`);
    }
    this.transactions.delete(txId);
    this.collectionTransactions.delete(txId);
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