// src/browser-sdk/storage/adapters/MemoryStorage.ts

import { StorageStrategy } from '../StorageStrategy';
import { StorageType } from '../types';

/**
 * Implements a storage strategy using in-memory storage. This is transient and not persistent.
 */
export class MemoryStorage implements StorageStrategy {
  readonly type = StorageType.Memory;
  private data: Map<string, any>;

  constructor() {
    this.data = new Map<string, any>();
  }

  async initialize(): Promise<void> {
    // In-memory storage does not require explicit initialization.
    return Promise.resolve();
  }

  async read<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }
    const item = this.data.get(key);
    return item !== undefined ? item : null;
  }

  async write<T>(key: string, value: T): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Memory storage is not available.');
    }
    this.data.set(key, value);
    return Promise.resolve();
  }

  async delete(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return Promise.resolve();
    }
    this.data.delete(key);
    return Promise.resolve();
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) {
      return Promise.resolve();
    }
    this.data.clear();
    return Promise.resolve();
  }

  async isAvailable(): Promise<boolean> {
    // Memory is always available in a running JS environment.
    return Promise.resolve(true);
  }

  async getEstimatedUsage(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    let totalBytes = 0;
    this.data.forEach(value => {
      // Rough estimate: convert object to string and assume 2 bytes per character
      totalBytes += JSON.stringify(value).length * 2;
    });
    return totalBytes;
  }
}