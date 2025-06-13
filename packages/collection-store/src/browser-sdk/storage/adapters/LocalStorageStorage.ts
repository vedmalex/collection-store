// src/browser-sdk/storage/adapters/LocalStorageStorage.ts

import { StorageStrategy } from '../StorageStrategy';
import { StorageType } from '../types';

/**
 * Implements a storage strategy using LocalStorage.
 */
export class LocalStorageStorage implements StorageStrategy {
  readonly type = StorageType.LocalStorage;
  private prefix: string;

  constructor(prefix: string = 'cs_v6_') {
    this.prefix = prefix;
  }

  async initialize(): Promise<void> {
    // LocalStorage doesn't require explicit initialization beyond browser availability check.
    return Promise.resolve();
  }

  private getKey(key: string): string {
    return this.prefix + key;
  }

  async read<T>(key: string): Promise<T | null> {
    if (!(await this.isAvailable())) {
      return null;
    }
    try {
      const item = localStorage.getItem(this.getKey(key));
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('LocalStorage read error:', e);
      return null;
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new Error('LocalStorage is not available.');
    }
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
      return Promise.resolve();
    } catch (e) {
      console.error('LocalStorage write error:', e);
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    if (!(await this.isAvailable())) {
      return Promise.resolve(); // If not available, nothing to delete
    }
    try {
      localStorage.removeItem(this.getKey(key));
      return Promise.resolve();
    } catch (e) {
      console.error('LocalStorage delete error:', e);
      throw e;
    }
  }

  async clear(): Promise<void> {
    if (!(await this.isAvailable())) {
      return Promise.resolve();
    }
    try {
      // Only clear items with the specific prefix to avoid clearing other app data
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      }
      return Promise.resolve();
    } catch (e) {
      console.error('LocalStorage clear error:', e);
      throw e;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testKey = '__test_storage__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('LocalStorage is not available or writeable:', e);
      return false;
    }
  }

  async getEstimatedUsage(): Promise<number> {
    if (!(await this.isAvailable())) {
      return 0;
    }
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const item = localStorage.getItem(key);
        if (item) {
          totalBytes += item.length * 2; // Rough estimate: 2 bytes per char for UTF-16
        }
      }
    }
    return totalBytes;
  }
}