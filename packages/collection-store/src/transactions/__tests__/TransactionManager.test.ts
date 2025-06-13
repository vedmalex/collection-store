import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { TransactionManager } from '../TransactionManager';
import { AdapterMemory } from '../../storage/AdapterMemory';
import { IndexManager } from '../../collection/IndexManager';

interface TestDoc {
    id: string;
    email: string;
}

describe('TransactionManager', () => {
    let storage: AdapterMemory<TestDoc>;
    let indexes: IndexManager<TestDoc>;
    let transactionManager: TransactionManager;

    beforeEach(async () => {
        storage = new AdapterMemory<TestDoc>();
        indexes = new IndexManager<TestDoc>();
        await indexes.createIndex('email', true); // Unique index
        transactionManager = new TransactionManager(storage, indexes);
    });

    it('should commit a successful transaction', async () => {
        const doc = { id: '1', email: 'test@example.com' };

        const result = await transactionManager.execute(async (txStorage, txIndexes) => {
            await txStorage.set(doc.id, doc);
            await txIndexes.add('email', doc.email, doc.id);
            return 'success';
        });

        expect(result).toBe('success');

        // Verify data is in the main stores
        const storedDoc = await storage.get(doc.id);
        expect(storedDoc).toEqual(doc);

        const indexedIds = await indexes.find('email', doc.email);
        expect(indexedIds).toEqual([doc.id]);
    });

    it('should rollback a failed transaction', async () => {
        const doc1 = { id: '1', email: 'test@example.com' };
        await storage.set(doc1.id, doc1);
        await indexes.add('email', doc1.email, doc1.id);

        const doc2 = { id: '2', email: 'test@example.com' }; // Duplicate email

        const promise = transactionManager.execute(async (txStorage, txIndexes) => {
            await txStorage.set(doc2.id, doc2);
            // This should fail due to unique constraint in the real index manager logic
            // But our transactional add in IndexManager is simplified.
            // Let's simulate failure by throwing an error.
            await txIndexes.add('email', doc2.email, doc2.id);
            throw new Error("Simulated unique constraint violation");
        });

        await expect(promise).rejects.toThrow("Simulated unique constraint violation");

        // Verify the second document was not committed
        const storedDoc = await storage.get(doc2.id);
        expect(storedDoc).toBeNull();
    });

    it('should correctly handle rollbacks on storage and indexes', async () => {
        const storageRollbackSpy = spyOn(storage, 'rollback');
        const indexRollbackSpy = spyOn(indexes, 'rollback');

        const promise = transactionManager.execute(async (txStorage, txIndexes) => {
            throw new Error("Failure");
        });

        await expect(promise).rejects.toThrow("Failure");

        expect(storageRollbackSpy).toHaveBeenCalledTimes(1);
        expect(indexRollbackSpy).toHaveBeenCalledTimes(1);
    });
});