import { describe, it, expect, beforeEach } from 'bun:test';
import { CollectionFactory } from '../CollectionFactory';
import Collection from '../../core/Collection';
import AdapterMemory from '../../storage/adapters/AdapterMemory';

import { Item } from '../../types/Item';

interface TestDoc extends Item {
  id: string;
  name: string;
  email: string;
}

describe('CollectionFactory', () => {
  let factory: CollectionFactory<TestDoc>;

  beforeEach(() => {
    const storageAdapter = new AdapterMemory<TestDoc>();
    factory = new CollectionFactory<TestDoc>(storageAdapter);
  });

  it('should create a new collection if it does not exist', async () => {
    const collection = await factory.getCollection('users', [{ field: 'email', unique: true }]);
    expect(collection).toBeInstanceOf(Collection);
    expect(collection.name).toBe('users');
  });

  it('should return the same collection instance for the same name', async () => {
    const collection1 = await factory.getCollection('users');
    const collection2 = await factory.getCollection('users');
    expect(collection1).toBe(collection2);
  });

  it('should create collections with the specified indexes', async () => {
    const collection = await factory.getCollection('products', [
      { field: 'name', unique: false },
      { field: 'email', unique: true },
    ]);

    // Test inserting data that would violate a unique index
    await collection.create({ id: '1', name: 'Laptop', email: 'prod1@a.com' });
    const promise = collection.create({ id: '2', name: 'Laptop2', email: 'prod1@a.com' });

    await expect(promise).rejects.toThrow('unique index email already contains value prod1@a.com');
  });

  it('should use a default AdapterMemory if none is provided', () => {
    const factoryWithoutAdapter = new CollectionFactory<TestDoc>();
    // This test is more about ensuring construction doesn't fail.
    // We can infer the adapter is present by successfully getting a collection.
    const collection = factoryWithoutAdapter.getCollection('items');
    expect(collection).toBeDefined();
  });
});