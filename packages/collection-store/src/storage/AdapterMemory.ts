import { IStorageAdapter } from './IStorageAdapter';
import { v4 as uuidv4 } from 'uuid';

export class AdapterMemory<T> implements IStorageAdapter<T> {
  private store: Map<string, T> = new Map();
  private transactions: Map<string, Map<string, T | null>> = new Map();

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

  async delete(key: string, txId?: string): Promise<void> {
    if (txId) {
        const txStore = this.transactions.get(txId);
        if(!txStore) throw new Error(`Transaction with id ${txId} not found.`);
        txStore.set(key, null); // Mark as deleted in transaction
    } else {
        this.store.delete(key);
    }
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
    return txId;
  }

  async commit(txId: string): Promise<void> {
    const txStore = this.transactions.get(txId);
    if (!txStore) {
      throw new Error(`Transaction with id ${txId} not found.`);
    }
    for (const [key, value] of txStore.entries()) {
      if (value === null) {
        this.store.delete(key);
      } else {
        this.store.set(key, value);
      }
    }
    this.transactions.delete(txId);
  }

  async rollback(txId: string): Promise<void> {
    if (!this.transactions.has(txId)) {
      throw new Error(`Transaction with id ${txId} not found.`);
    }
    this.transactions.delete(txId);
  }

  async init(): Promise<void> {
    // No-op for memory adapter
  }

  async create(collection: string, data: T): Promise<string> {
    throw new Error("Method not implemented for AdapterMemory.");
  }

  async read(collection: string, id: string): Promise<T | null> {
    throw new Error("Method not implemented for AdapterMemory.");
  }

  async update(collection: string, id: string, data: T): Promise<void> {
    throw new Error("Method not implemented for AdapterMemory.");
  }

  async find(collection: string, query: any): Promise<T[]> {
    throw new Error("Method not implemented for AdapterMonitor.");
  }

  async close(): Promise<void> {
    // No-op for memory adapter
  }
}