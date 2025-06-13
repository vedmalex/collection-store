/// <reference lib="dom" />
// src/browser-sdk/storage/adapters/IndexedDBStorage.ts

import { StorageStrategy } from '../StorageStrategy';
import { StorageType, QuotaInfo } from '../types';

/**
 * Implements a storage strategy using IndexedDB.
 */
export class IndexedDBStorage implements StorageStrategy {
  readonly type = StorageType.IndexedDB;
  private db: IDBDatabase | null = null;
  private dbName: string;
  private storeName: string;

  constructor(dbName: string = 'collection-store-db', storeName: string = 'data') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('IndexedDB initialization error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('IndexedDB is not initialized.');
    }
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  async read<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore('readonly');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('IndexedDB read error:', request.error);
        reject(request.error);
      };
    });
  }

  async write<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore('readwrite');
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB write error:', request.error);
        reject(request.error);
      };
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore('readwrite');
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB delete error:', request.error);
        reject(request.error);
      };
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getObjectStore('readwrite');
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB clear error:', request.error);
        reject(request.error);
      };
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!('indexedDB' in window)) {
      return false;
    }
    try {
      const db = await this.initialize();
      return true;
    } catch (e) {
      return false;
    }
  }

  async getEstimatedUsage(): Promise<number> {
    // IndexedDB does not directly expose usage per object store easily without iterating.
    // This is a placeholder; a more accurate implementation would iterate through all records
    // or use StorageManager.estimate() if available and appropriate.
    if (!('indexedDB' in window && navigator.storage && navigator.storage.estimate)) {
      return 0;
    }
    try {
      const estimate = await navigator.storage.estimate();
      // Returns total usage across all IndexedDB and Cache Storage, not specific to this DB/store.
      return estimate.usage || 0;
    } catch (e) {
      console.warn('Could not estimate IndexedDB usage:', e);
      return 0;
    }
  }
}