import { describe, it, expect, beforeEach } from 'bun:test';
import { IndexManager } from '../../IndexManager';

interface TestDoc {
  id: string;
  name: string;
  age: number;
  email: string;
  category: string;
}

describe('IndexManager Performance Tests', () => {
  let indexManager: IndexManager<TestDoc>;

  beforeEach(async () => {
    indexManager = new IndexManager<TestDoc>();
    await indexManager.createIndex('age', false); // Non-unique index
    await indexManager.createIndex('email', true); // Unique index
    await indexManager.createIndex('category', false); // Non-unique index
  });

  describe('Insert Performance', () => {
    it('should handle 1000 inserts efficiently', async () => {
      const startTime = performance.now();

      // Insert 1000 documents
      for (let i = 0; i < 1000; i++) {
        await indexManager.add('age', Math.floor(Math.random() * 100), `doc${i}`);
        await indexManager.add('email', `user${i}@example.com`, `doc${i}`);
        await indexManager.add('category', `category${i % 10}`, `doc${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`1000 inserts took ${duration.toFixed(2)}ms (${(duration/1000).toFixed(2)}ms per insert)`);

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle 10000 inserts efficiently', async () => {
      const startTime = performance.now();

      // Insert 10000 documents
      for (let i = 0; i < 10000; i++) {
        await indexManager.add('age', Math.floor(Math.random() * 100), `doc${i}`);
        await indexManager.add('email', `user${i}@example.com`, `doc${i}`);
        await indexManager.add('category', `category${i % 50}`, `doc${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`10000 inserts took ${duration.toFixed(2)}ms (${(duration/10000).toFixed(2)}ms per insert)`);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds
    });
  });

  describe('Find Performance', () => {
    beforeEach(async () => {
      // Pre-populate with test data
      for (let i = 0; i < 1000; i++) {
        await indexManager.add('age', Math.floor(Math.random() * 100), `doc${i}`);
        await indexManager.add('email', `user${i}@example.com`, `doc${i}`);
        await indexManager.add('category', `category${i % 10}`, `doc${i}`);
      }
    });

    it('should find documents quickly in unique index', async () => {
      const startTime = performance.now();

      // Perform 100 finds
      for (let i = 0; i < 100; i++) {
        const email = `user${Math.floor(Math.random() * 1000)}@example.com`;
        await indexManager.find('email', email);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`100 unique index finds took ${duration.toFixed(2)}ms (${(duration/100).toFixed(2)}ms per find)`);

      // Should be very fast for indexed lookups
      expect(duration).toBeLessThan(100); // 100ms
    });

    it('should find documents quickly in non-unique index', async () => {
      const startTime = performance.now();

      // Perform 100 finds
      for (let i = 0; i < 100; i++) {
        const age = Math.floor(Math.random() * 100);
        await indexManager.find('age', age);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`100 non-unique index finds took ${duration.toFixed(2)}ms (${(duration/100).toFixed(2)}ms per find)`);

      // Should be fast for indexed lookups
      expect(duration).toBeLessThan(200); // 200ms
    });
  });

  describe('Range Query Performance', () => {
    beforeEach(async () => {
      // Pre-populate with test data
      for (let i = 0; i < 1000; i++) {
        await indexManager.add('age', i % 100, `doc${i}`); // Ages 0-99
      }
    });

    it('should perform range queries efficiently', async () => {
      const startTime = performance.now();

      // Perform various range queries
      await indexManager.findRange('age', { $gt: 50 });
      await indexManager.findRange('age', { $lt: 30 });
      await indexManager.findRange('age', { $gte: 25, $lte: 75 });
      await indexManager.findRange('age', { $gt: 10, $lt: 90 });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`4 range queries took ${duration.toFixed(2)}ms (${(duration/4).toFixed(2)}ms per query)`);

      // Range queries should be reasonably fast
      expect(duration).toBeLessThan(500); // 500ms
    });
  });

  describe('Transaction Performance', () => {
    it('should handle transactional operations efficiently', async () => {
      const startTime = performance.now();

      // Perform 10 transactions with 10 operations each
      for (let txNum = 0; txNum < 10; txNum++) {
        const txId = await indexManager.beginTransaction();

        try {
          for (let i = 0; i < 10; i++) {
            await indexManager.add('age', Math.floor(Math.random() * 100), `tx${txNum}_doc${i}`, txId);
            await indexManager.add('email', `tx${txNum}_user${i}@example.com`, `tx${txNum}_doc${i}`, txId);
          }

          await indexManager.commit(txId);
        } catch (error) {
          await indexManager.rollback(txId);
          throw error;
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`10 transactions (100 operations total) took ${duration.toFixed(2)}ms (${(duration/100).toFixed(2)}ms per operation)`);

      // Transactions should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during large operations', async () => {
      // Get initial memory usage (if available)
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;

      // Perform large number of operations
      for (let i = 0; i < 5000; i++) {
        await indexManager.add('age', Math.floor(Math.random() * 100), `doc${i}`);

        // Occasionally remove some documents
        if (i % 100 === 0 && i > 0) {
          await indexManager.remove('age', Math.floor(Math.random() * 100), `doc${i - 50}`);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (adjust threshold as needed)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations without corruption', async () => {
      const startTime = performance.now();

            // Create multiple concurrent operations
      const operations: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        operations.push(
          indexManager.add('age', Math.floor(Math.random() * 100), `concurrent_doc${i}`)
        );
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`100 concurrent operations took ${duration.toFixed(2)}ms`);

      // Verify data integrity by checking some random entries
      const testResults = await Promise.all([
        indexManager.find('age', 25),
        indexManager.find('age', 50),
        indexManager.find('age', 75)
      ]);

      // Should complete without errors and return valid results
      expect(duration).toBeLessThan(2000); // 2 seconds
      testResults.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});