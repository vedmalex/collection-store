import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { IndexManager } from '../IndexManager';

interface TestDoc {
  id: string;
  name: string;
  age: number;
  email: string;
}

describe('IndexManager', () => {
  let indexManager: IndexManager<TestDoc>;

  beforeEach(() => {
    indexManager = new IndexManager<TestDoc>();
  });

  it('should create a unique index', async () => {
    await indexManager.createIndex('email', true);
    // Simple check to ensure no error is thrown and index is created internally
    // More detailed checks will be in other tests
  });

  it('should create a non-unique index', async () => {
    await indexManager.createIndex('age', false);
  });

  it('should throw an error if index already exists', async () => {
    await indexManager.createIndex('name', true);
    await expect(indexManager.createIndex('name', true)).rejects.toThrow('Index on field "name" already exists.');
  });

  describe('with unique index', () => {
    beforeEach(async () => {
      await indexManager.createIndex('email', true);
      await indexManager.add('email', 'alice@example.com', 'doc1');
      await indexManager.add('email', 'bob@example.com', 'doc2');
    });

    it('should find a document by unique field', async () => {
      const docIds = await indexManager.find('email', 'alice@example.com');
      expect(docIds).toEqual(['doc1']);
    });

    it('should return an empty array if not found', async () => {
      const docIds = await indexManager.find('email', 'charlie@example.com');
      expect(docIds).toEqual([]);
    });

    it('should throw on unique constraint violation', async () => {
      const promise = indexManager.add('email', 'alice@example.com', 'doc3');
      expect(promise).rejects.toThrow('Unique constraint violation on field "email" for value "alice@example.com"');
    });

    it('should remove a document from index', async () => {
      await indexManager.remove('email', 'alice@example.com', 'doc1');
      const docIds = await indexManager.find('email', 'alice@example.com');
      expect(docIds).toEqual([]);
    });
  });

  describe('with non-unique index', () => {
    beforeEach(async () => {
      await indexManager.createIndex('age', false);
      await indexManager.add('age', 30, 'doc1');
      await indexManager.add('age', 30, 'doc2');
      await indexManager.add('age', 35, 'doc3');
    });

    it('should find multiple documents by non-unique field', async () => {
      const docIds = await indexManager.find('age', 30);
      expect(docIds).toHaveLength(2);
      expect(docIds).toContain('doc1');
      expect(docIds).toContain('doc2');
    });

    it('should add a new document to an existing key', async () => {
      await indexManager.add('age', 30, 'doc4');
      const docIds = await indexManager.find('age', 30);
      expect(docIds).toHaveLength(3);
      expect(docIds).toContain('doc4');
    });

    it('should remove one document from a non-unique key', async () => {
      // FIXED: Implemented read-modify-write pattern for non-unique index removal
      // This now correctly removes a specific docId from a non-unique index
      // while preserving other docIds for the same key
      await indexManager.remove('age', 30, 'doc1');
      const docIds = await indexManager.find('age', 30);
      expect(docIds).toHaveLength(1);
      expect(docIds).not.toContain('doc1');
    });

    it('should remove the key if last document is removed', async () => {
      await indexManager.remove('age', 35, 'doc3');
      const docIds = await indexManager.find('age', 35);
      expect(docIds).toEqual([]);
    });
  });

  describe('findRange', () => {
    // Testing range queries with fallback implementation
    // If b-pl-tree range() method fails, we fall back to manual implementation
    beforeEach(async () => {
      // Re-create manager and index to ensure clean state
      indexManager = new IndexManager<TestDoc>();
      await indexManager.createIndex('age', false);
      // Non-unique index on age
      await indexManager.add('age', 25, 'doc1'); // Edge
      await indexManager.add('age', 30, 'doc2');
      await indexManager.add('age', 30, 'doc3');
      await indexManager.add('age', 40, 'doc4');
      await indexManager.add('age', 50, 'doc5'); // Edge
    });

    it('should find documents with age > 30', async () => {
      const docIds = await indexManager.findRange('age', { $gt: 30 });
      expect(docIds).toHaveLength(2);
      expect(docIds).toContain('doc4');
      expect(docIds).toContain('doc5');
    });

    it('should find documents with age < 40', async () => {
      const docIds = await indexManager.findRange('age', { $lt: 40 });
      expect(docIds).toHaveLength(3);
      expect(docIds).toContain('doc1');
      expect(docIds).toContain('doc2');
      expect(docIds).toContain('doc3');
    });

    it('should find documents with age >= 40', async () => {
      const docIds = await indexManager.findRange('age', { $gte: 40 });
      expect(docIds).toHaveLength(2);
      expect(docIds).toContain('doc4');
      expect(docIds).toContain('doc5');
    });

    it('should find documents with age <= 30', async () => {
      const docIds = await indexManager.findRange('age', { $lte: 30 });
      expect(docIds).toHaveLength(3);
      expect(docIds).toContain('doc1');
      expect(docIds).toContain('doc2');
      expect(docIds).toContain('doc3');
    });

    it('should handle ranges with no results', async () => {
      const docIds = await indexManager.findRange('age', { $gt: 100 });
      expect(docIds).toHaveLength(0);
    });
  });
});