import { IndexManager } from '../collection/IndexManager';
import { beforeAll, describe, expect, it } from 'bun:test';

interface PerfTestDoc {
    id: string;
    value: number;
}

const NUM_DOCS = 10000;

describe('IndexManager Performance', () => {
    let indexManager: IndexManager<PerfTestDoc>;

    // Setup a single manager for all tests to avoid re-creation overhead
    beforeAll(async () => {
        indexManager = new IndexManager<PerfTestDoc>();
        await indexManager.createIndex('value', true); // Unique index
    });

    it(`should handle ${NUM_DOCS} unique inserts in a reasonable time`, async () => {
        const startTime = performance.now();

        for (let i = 0; i < NUM_DOCS; i++) {
            await indexManager.add('value', i, `doc${i}`);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`Unique Inserts: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(2000); // Expect to be less than 2s
    });

    it(`should handle ${NUM_DOCS} unique finds in a reasonable time`, async () => {
        const startTime = performance.now();

        for (let i = 0; i < NUM_DOCS; i++) {
            await indexManager.find('value', i);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`Unique Finds: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(1000); // Expect to be less than 1s
    });

    it(`should handle ${NUM_DOCS} unique removes in a reasonable time`, async () => {
        const startTime = performance.now();

        for (let i = 0; i < NUM_DOCS; i++) {
            await indexManager.remove('value', i, `doc${i}`);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`Unique Removes: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(2000); // Expect to be less than 2s
    });

    // --- Non-unique index tests ---
    describe('with non-unique index', () => {
        beforeAll(async () => {
            indexManager = new IndexManager<PerfTestDoc>();
            await indexManager.createIndex('value', false); // Non-unique index
        });

        it(`should handle ${NUM_DOCS} non-unique inserts in a reasonable time`, async () => {
            const startTime = performance.now();

            for (let i = 0; i < NUM_DOCS; i++) {
                // Insert 10 docs for every 1000 values
                await indexManager.add('value', i % 1000, `doc${i}`);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`Non-Unique Inserts: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(2000);
        });
    });
});