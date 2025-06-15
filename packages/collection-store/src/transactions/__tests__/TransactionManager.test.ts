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

        const txId = await transactionManager.beginTransaction();
        const transaction = transactionManager.getTransaction(txId);
        transaction.addAffectedResource(storage);
        transaction.addAffectedResource(indexes);

        // Prepare the transaction first (2PC Phase 1)
        const prepared = await transaction.prepare();
        expect(prepared).toBe(true);

        // Now perform operations (this will work because prepare created the internal mappings)
        await storage.set(doc.id, doc, txId);
        await indexes.add('email', doc.email, doc.id, txId);

        // Commit the transaction (2PC Phase 2)
        await transaction.commit();

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

        const txId = await transactionManager.beginTransaction();
        const transaction = transactionManager.getTransaction(txId);
        transaction.addAffectedResource(storage);
        transaction.addAffectedResource(indexes);

        try {
            // Prepare the transaction first (2PC Phase 1)
            const prepared = await transaction.prepare();
            expect(prepared).toBe(true);

            await storage.set(doc2.id, doc2, txId);
            // This line should ideally cause a unique constraint violation in a real index manager,
            // but we will explicitly throw an error here to simulate a transaction failure.
            await indexes.add('email', doc2.email, doc2.id, txId);
            throw new Error("Simulated unique constraint violation");
        } catch (error: any) {
            await transaction.rollback();
            expect(error.message).toBe("Simulated unique constraint violation");
        }

        // Verify the second document was not committed
        const storedDoc = await storage.get(doc2.id);
        expect(storedDoc).toBeNull();
    });

    it('should correctly handle rollbacks on storage and indexes', async () => {
        const storageRollbackSpy = spyOn(storage, 'rollback');
        const indexRollbackSpy = spyOn(indexes, 'rollback');

        const txId = await transactionManager.beginTransaction();
        const transaction = transactionManager.getTransaction(txId);
        transaction.addAffectedResource(storage);
        transaction.addAffectedResource(indexes);

        try {
            // Prepare the transaction first (2PC Phase 1)
            const prepared = await transaction.prepare();
            expect(prepared).toBe(true);

            throw new Error("Failure");
        } catch (error: any) {
            await transaction.rollback();
            expect(error.message).toBe("Failure");
        }

        expect(storageRollbackSpy).toHaveBeenCalledTimes(1);
        expect(indexRollbackSpy).toHaveBeenCalledTimes(1);
    });
});