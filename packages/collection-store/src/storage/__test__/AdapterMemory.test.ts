import { describe, it, expect, beforeEach } from 'bun:test';
import { AdapterMemory }  from '../AdapterMemory';

describe('AdapterMemory', () => {
  let adapter: AdapterMemory<any>;

  beforeEach(async () => {
    adapter = new AdapterMemory<any>();
    await adapter.init();
  });

  it('should create and read a record', async () => {
    const data = { name: 'test', value: 123 };
    const id = await adapter.create('testCollection', data);

    expect(id).toBeTypeOf('string');

    const record = await adapter.read('testCollection', id);
    expect(record).not.toBeNull();
    expect(record._id).toBe(id);
    expect(record.name).toBe('test');
  });

  it('should return null when reading a non-existent record', async () => {
    const record = await adapter.read('testCollection', 'non-existent-id');
    expect(record).toBeNull();
  });

  it('should update a record', async () => {
    const data = { name: 'initial' };
    const id = await adapter.create('testCollection', data);

    const updatedData = { name: 'updated' };
    await adapter.update('testCollection', id, updatedData);

    const record = await adapter.read('testCollection', id);
    expect(record?.name).toBe('updated');
  });

  it('should not throw when updating a non-existent record', async () => {
    await expect(adapter.update('testCollection', 'non-existent', { name: 'test' })).resolves.toBeUndefined();
  });

  it('should delete a record', async () => {
    const data = { name: 'to-delete' };
    const id = await adapter.create('testCollection', data);

    await adapter.delete('testCollection', id);
    const record = await adapter.read('testCollection', id);
    expect(record).toBeNull();
  });

  it('should find records matching a query', async () => {
    await adapter.create('queryCollection', { type: 'A', value: 1 });
    await adapter.create('queryCollection', { type: 'B', value: 2 });
    await adapter.create('queryCollection', { type: 'A', value: 3 });

    const results = await adapter.find('queryCollection', { type: 'A' });
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('A');
    expect(results[1].type).toBe('A');
  });

  it('should return an empty array if no records match a query', async () => {
    const results = await adapter.find('queryCollection', { type: 'C' });
    expect(results).toHaveLength(0);
  });

  it('should return an empty array if the collection does not exist', async () => {
    const results = await adapter.find('nonExistentCollection', { type: 'A' });
    expect(results).toHaveLength(0);
  });

  it('should clear all data on close', async () => {
    await adapter.create('collection', { name: 'data' });
    await adapter.close();
    const results = await adapter.find('collection', {});
    expect(results).toHaveLength(0);
  });
});