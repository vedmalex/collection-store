import { BPlusTree } from 'b-pl-tree';
import { IndexManager } from '../IndexManager';
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { AdapterMemory } from '../../storage/AdapterMemory';
import { IStorageAdapter } from '../../storage/IStorageAdapter';

interface TestDoc {
  id: string;
  name: string;
  age: number;
  email: string;
}

describe('IndexManager Transactions', () => {
  let indexManager: IndexManager<TestDoc>;

  beforeEach(async () => {
    indexManager = new IndexManager<TestDoc>();
    await indexManager.createIndex('age', false); // Non-unique index
    await indexManager.createIndex('email', true); // Unique index
  });

  it('should correctly add and remove a single docId from a non-unique index within a transaction', async () => {
    // Setup initial data
    await indexManager.add('age', 30, 'doc1');
    await indexManager.add('age', 30, 'doc2');

    // Verify initial state
    let docIds = await indexManager.find('age', 30);
    expect(docIds).toHaveLength(2);
    expect(docIds).toContain('doc1');
    expect(docIds).toContain('doc2');

    // Start transaction
    const txId = await indexManager.beginTransaction();

    // Add a new document in transaction
    await indexManager.add('age', 30, 'doc3', txId);

    // Remove one document in transaction
    await indexManager.remove('age', 30, 'doc1', txId);

    // Verify that main index is unchanged before commit
    docIds = await indexManager.find('age', 30);
    expect(docIds).toHaveLength(2);
    expect(docIds).toContain('doc1');
    expect(docIds).toContain('doc2');

    // Commit transaction
    await indexManager.commit(txId);

    // Verify final state after commit
    docIds = await indexManager.find('age', 30);
    expect(docIds).toHaveLength(2);
    expect(docIds).toContain('doc2');
    expect(docIds).toContain('doc3');
    expect(docIds).not.toContain('doc1');
  });

  it('should correctly rollback an add operation in a non-unique index', async () => {
    // Setup initial data
    await indexManager.add('age', 25, 'doc1');

    // Verify initial state
    let docIds = await indexManager.find('age', 25);
    expect(docIds).toHaveLength(1);
    expect(docIds).toContain('doc1');

    // Start transaction
    const txId = await indexManager.beginTransaction();

    // Add documents in transaction
    await indexManager.add('age', 25, 'doc2', txId);
    await indexManager.add('age', 25, 'doc3', txId);

    // Verify main index is unchanged before rollback
    docIds = await indexManager.find('age', 25);
    expect(docIds).toHaveLength(1);
    expect(docIds).toContain('doc1');

    // Rollback transaction
    await indexManager.rollback(txId);

    // Verify state is unchanged after rollback
    docIds = await indexManager.find('age', 25);
    expect(docIds).toHaveLength(1);
    expect(docIds).toContain('doc1');
  });

  it('should correctly rollback a remove operation in a non-unique index', async () => {
    // Setup initial data
    await indexManager.add('age', 35, 'doc1');
    await indexManager.add('age', 35, 'doc2');
    await indexManager.add('age', 35, 'doc3');

    // Verify initial state
    let docIds = await indexManager.find('age', 35);
    expect(docIds).toHaveLength(3);

    // Start transaction
    const txId = await indexManager.beginTransaction();

    // Remove documents in transaction
    await indexManager.remove('age', 35, 'doc1', txId);
    await indexManager.remove('age', 35, 'doc2', txId);

    // Verify main index is unchanged before rollback
    docIds = await indexManager.find('age', 35);
    expect(docIds).toHaveLength(3);

    // Rollback transaction
    await indexManager.rollback(txId);

    // Verify state is unchanged after rollback
    docIds = await indexManager.find('age', 35);
    expect(docIds).toHaveLength(3);
    expect(docIds).toContain('doc1');
    expect(docIds).toContain('doc2');
    expect(docIds).toContain('doc3');
  });
});