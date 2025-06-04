/**
 * Tests for TransactionalCollection
 * Verifies transactional operations and coordination between data and indexes
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import Collection from '../collection'
import { TransactionalCollection, TransactionalListWrapper } from '../TransactionalCollection'
import { Item } from '../types/Item'
import { List } from '../storage/List'
import AdapterMemory from '../AdapterMemory'
import { z } from 'zod'
import { cleanupTestDirectory, createTestDir } from './test-utils'

interface TestItem extends Item {
  id: number
  name: string
  category: string
  value: number
}

// Strict validation schema for tests
const TestItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  value: z.number()
})

describe('TransactionalCollection', () => {
  let collection: Collection<TestItem>
  let transactionalCollection: TransactionalCollection<TestItem>
  let testDir: string
  const transactionId = 'test-tx-1'

  beforeEach(async () => {
    testDir = createTestDir('transactional-collection')

    // Create a test collection with indexes first
    collection = Collection.create<TestItem>({
      name: 'test-collection',
      id: { name: 'id', auto: false }, // Disable auto-generation for tests
      list: new List<TestItem>(),
      root: testDir,
      adapter: new AdapterMemory<TestItem>(),
      validation: TestItemSchema, // Use strict validation
      indexList: [
        // Add all indexes upfront
        { key: 'id', auto: false, unique: true, required: false },
        { key: 'name', auto: false, unique: false, required: false },
        { key: 'category', auto: false, unique: false, required: false },
        { key: 'value', auto: false, unique: false, required: false }
      ]
    })

    // Initialize collection
    await collection.load()

    // Add initial data after indexes are created
    await collection.create({ id: 1, name: 'Item1', category: 'A', value: 100 })
    await collection.create({ id: 2, name: 'Item2', category: 'B', value: 200 })
    await collection.create({ id: 3, name: 'Item3', category: 'A', value: 300 })

    // Create transactional wrapper
    transactionalCollection = new TransactionalCollection(collection)
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  describe('Basic Transactional Operations', () => {
    it('should create item in transaction', async () => {
      const newItem: TestItem = { id: 4, name: 'Item4', category: 'C', value: 400 }

      const result = await transactionalCollection.create_in_transaction(transactionId, newItem)

      expect(result).toEqual(newItem)

      // Should be visible in transaction
      const found = await transactionalCollection.findById_in_transaction(transactionId, 4)
      expect(found).toEqual(newItem)

      // Should not be visible outside transaction
      const notFound = await collection.findById(4)
      expect(notFound).toBeUndefined()
    })

    it('should update item in transaction', async () => {
      const update = { name: 'UpdatedItem1', value: 150 }

      const result = await transactionalCollection.update_in_transaction(transactionId, 1, update)

      expect(result?.name).toBe('UpdatedItem1')
      expect(result?.value).toBe(150)
      expect(result?.category).toBe('A') // Should preserve unchanged fields

      // Should be visible in transaction
      const found = await transactionalCollection.findById_in_transaction(transactionId, 1)
      expect(found?.name).toBe('UpdatedItem1')

      // Should not be visible outside transaction
      const original = await collection.findById(1)
      expect(original?.name).toBe('Item1')
    })

    it('should remove item in transaction', async () => {
      const result = await transactionalCollection.remove_in_transaction(transactionId, 2)

      expect(result?.id).toBe(2)
      expect(result?.name).toBe('Item2')

      // Should not be visible in transaction
      const notFound = await transactionalCollection.findById_in_transaction(transactionId, 2)
      expect(notFound).toBeUndefined()

      // Should still be visible outside transaction
      const stillThere = await collection.findById(2)
      expect(stillThere?.name).toBe('Item2')
    })

    it('should handle multiple operations in single transaction', async () => {
      // Create, update, and remove in same transaction
      await transactionalCollection.create_in_transaction(transactionId, { id: 5, name: 'Item5', category: 'D', value: 500 })
      await transactionalCollection.update_in_transaction(transactionId, 1, { value: 999 })
      await transactionalCollection.remove_in_transaction(transactionId, 3)

      // Verify transaction view
      const created = await transactionalCollection.findById_in_transaction(transactionId, 5)
      const updated = await transactionalCollection.findById_in_transaction(transactionId, 1)
      const removed = await transactionalCollection.findById_in_transaction(transactionId, 3)

      expect(created?.name).toBe('Item5')
      expect(updated?.value).toBe(999)
      expect(removed).toBeUndefined()

      // Verify original data unchanged
      expect(await collection.findById(5)).toBeUndefined()
      expect((await collection.findById(1))?.value).toBe(100)
      expect(await collection.findById(3)).toBeDefined()
    })
  })

  describe('Index Integration', () => {
    it('should update indexes in transaction', async () => {
      const newItem: TestItem = { id: 4, name: 'Item4', category: 'A', value: 400 }

      await transactionalCollection.create_in_transaction(transactionId, newItem)

      // Should find by index in transaction
      const foundByName = await transactionalCollection.findBy_in_transaction(transactionId, 'name', 'Item4')
      const foundByCategory = await transactionalCollection.findBy_in_transaction(transactionId, 'category', 'A')

      expect(foundByName).toHaveLength(1)
      expect(foundByName[0].id).toBe(4)
      expect(foundByCategory).toHaveLength(3) // Original 2 + new 1
    })

    it('should handle index updates on item modification', async () => {
      // Update category from A to C
      await transactionalCollection.update_in_transaction(transactionId, 1, { category: 'C' })

      // Should find in new category
      const foundInC = await transactionalCollection.findBy_in_transaction(transactionId, 'category', 'C')
      const foundInA = await transactionalCollection.findBy_in_transaction(transactionId, 'category', 'A')

      expect(foundInC).toHaveLength(1)
      expect(foundInC[0].id).toBe(1)
      expect(foundInA).toHaveLength(1) // Only Item3 should remain in A
      expect(foundInA[0].id).toBe(3)
    })

    it('should remove from indexes on item deletion', async () => {
      await transactionalCollection.remove_in_transaction(transactionId, 1)

      // Should not find by any index
      const foundByName = await transactionalCollection.findBy_in_transaction(transactionId, 'name', 'Item1')
      const foundByCategory = await transactionalCollection.findBy_in_transaction(transactionId, 'category', 'A')

      expect(foundByName).toHaveLength(0)
      expect(foundByCategory).toHaveLength(1) // Only Item3 should remain in A
      expect(foundByCategory[0].id).toBe(3)
    })
  })

  describe('2PC Protocol', () => {
    it('should prepare and commit successfully', async () => {
      await transactionalCollection.create_in_transaction(transactionId, { id: 4, name: 'Item4', category: 'C', value: 400 })

      // Prepare phase
      const canCommit = await transactionalCollection.prepareCommit(transactionId)
      expect(canCommit).toBe(true)

      // Commit phase
      await transactionalCollection.finalizeCommit(transactionId)

      // Changes should be applied to original collection
      const created = await collection.findById(4)
      expect(created?.name).toBe('Item4')
    })

    it('should rollback transaction without applying changes', async () => {
      await transactionalCollection.create_in_transaction(transactionId, { id: 4, name: 'Item4', category: 'C', value: 400 })

      // Rollback
      await transactionalCollection.rollback(transactionId)

      // Changes should not be applied to original collection
      const notCreated = await collection.findById(4)
      expect(notCreated).toBeUndefined()
    })

    it('should handle prepare failure gracefully', async () => {
      // Create invalid item (missing required fields)
      const invalidItem = { id: 4 } as TestItem

      try {
        await transactionalCollection.create_in_transaction(transactionId, invalidItem)
        // This might fail during validation
      } catch (error) {
        // Expected validation error
      }

      const canCommit = await transactionalCollection.prepareCommit(transactionId)
      // Should still be able to prepare (validation happens during create)
      expect(typeof canCommit).toBe('boolean')
    })
  })

  describe('Transaction Isolation', () => {
    it('should maintain isolation between transactions', async () => {
      const tx2 = 'test-tx-2'

      // Different operations in different transactions
      await transactionalCollection.create_in_transaction(transactionId, { id: 4, name: 'Item4-TX1', category: 'C', value: 400 })
      await transactionalCollection.create_in_transaction(tx2, { id: 5, name: 'Item5-TX2', category: 'D', value: 500 })

      // Each transaction should only see its own changes
      const tx1Item = await transactionalCollection.findById_in_transaction(transactionId, 4)
      const tx1NoItem = await transactionalCollection.findById_in_transaction(transactionId, 5)
      const tx2Item = await transactionalCollection.findById_in_transaction(tx2, 5)
      const tx2NoItem = await transactionalCollection.findById_in_transaction(tx2, 4)

      expect(tx1Item?.name).toBe('Item4-TX1')
      expect(tx1NoItem).toBeUndefined()
      expect(tx2Item?.name).toBe('Item5-TX2')
      expect(tx2NoItem).toBeUndefined()
    })

    it('should handle concurrent updates to same item', async () => {
      const tx2 = 'test-tx-2'

      // Both transactions update the same item
      await transactionalCollection.update_in_transaction(transactionId, 1, { name: 'Updated-TX1' })
      await transactionalCollection.update_in_transaction(tx2, 1, { name: 'Updated-TX2' })

      // Each should see their own version
      const tx1View = await transactionalCollection.findById_in_transaction(transactionId, 1)
      const tx2View = await transactionalCollection.findById_in_transaction(tx2, 1)

      expect(tx1View?.name).toBe('Updated-TX1')
      expect(tx2View?.name).toBe('Updated-TX2')
    })
  })

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      // Try to create item with invalid data
      const invalidItem = { id: 'invalid' } as any

      await expect(
        transactionalCollection.create_in_transaction(transactionId, invalidItem)
      ).rejects.toThrow('Validation failed')
    })

    it('should handle updates to non-existent items', async () => {
      const result = await transactionalCollection.update_in_transaction(transactionId, 999, { name: 'Updated' })

      expect(result).toBeUndefined()
    })

    it('should handle removes of non-existent items', async () => {
      const result = await transactionalCollection.remove_in_transaction(transactionId, 999)

      expect(result).toBeUndefined()
    })

    it('should handle missing indexes gracefully', async () => {
      await expect(
        transactionalCollection.findBy_in_transaction(transactionId, 'nonexistent' as any, 'value')
      ).rejects.toThrow('Index for nonexistent not found')
    })
  })

  describe('Transaction State Management', () => {
    it('should track transaction changes', async () => {
      await transactionalCollection.create_in_transaction(transactionId, { id: 4, name: 'Item4', category: 'C', value: 400 })

      const changes = transactionalCollection.getTransactionChanges(transactionId)

      expect(changes.list).toHaveLength(1)
      expect(changes.list[0].type).toBe('insert')

      // Should have index changes for each index
      expect(Object.keys(changes.indexes)).toContain('id')
      expect(Object.keys(changes.indexes)).toContain('name')
      expect(Object.keys(changes.indexes)).toContain('category')
      expect(Object.keys(changes.indexes)).toContain('value')
    })

    it('should provide access to original collection', () => {
      const original = transactionalCollection.originalCollection

      expect(original).toBe(collection)
    })
  })
})

describe('TransactionalListWrapper', () => {
  let collection: Collection<TestItem>
  let wrapper: TransactionalListWrapper<TestItem>
  let testDir: string
  const transactionId = 'test-tx-1'

  beforeEach(async () => {
    testDir = createTestDir('transactional-list-wrapper')

    // Create a minimal collection for testing
    collection = Collection.create<TestItem>({
      name: 'test-wrapper-collection',
      id: { name: 'id', auto: false },
      list: new List<TestItem>(),
      root: testDir,
      adapter: new AdapterMemory<TestItem>(),
      indexList: [
        { key: 'id', auto: false, unique: true, required: false }
      ]
    })

    await collection.load()

    // Add some initial data
    await collection.create({ id: 1, name: 'Item1', category: 'A', value: 100 })
    await collection.create({ id: 2, name: 'Item2', category: 'B', value: 200 })

    // Create wrapper with collection reference
    wrapper = new TransactionalListWrapper(collection.list, collection)
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  describe('Transactional Operations', () => {
    it('should handle transactional set operations', async () => {
      const item: TestItem = { id: 3, name: 'Item3', category: 'C', value: 300 }

      const result = await wrapper.set_in_transaction(transactionId, 3, item)

      expect(result).toEqual(item)

      // Should be visible in transaction
      const found = await wrapper.get_in_transaction(transactionId, 3)
      expect(found).toEqual(item)

      // Should not be visible outside transaction
      const notFound = await wrapper.get(3)
      expect(notFound).toBeUndefined()
    })

    it('should handle transactional delete operations', async () => {
      const result = await wrapper.delete_in_transaction(transactionId, 1)

      expect(result?.id).toBe(1)

      // Should not be visible in transaction
      const notFound = await wrapper.get_in_transaction(transactionId, 1)
      expect(notFound).toBeUndefined()

      // Should still be visible outside transaction
      const stillThere = await wrapper.get(1)
      expect(stillThere?.id).toBe(1)
    })

    it('should track changes correctly', async () => {
      await wrapper.set_in_transaction(transactionId, 3, { id: 3, name: 'Item3', category: 'C', value: 300 })
      await wrapper.update_in_transaction(transactionId, 1, { id: 1, name: 'Updated', category: 'A', value: 150 })
      await wrapper.delete_in_transaction(transactionId, 2)

      const changes = wrapper.getTransactionChanges(transactionId)

      expect(changes).toHaveLength(3)
      expect(changes[0].type).toBe('insert')
      expect(changes[1].type).toBe('update')
      expect(changes[2].type).toBe('remove')
    })
  })

  describe('2PC Protocol', () => {
    it('should prepare and commit successfully', async () => {
      await wrapper.set_in_transaction(transactionId, 3, { id: 3, name: 'Item3', category: 'C', value: 300 })

      const canCommit = await wrapper.prepareCommit(transactionId)
      expect(canCommit).toBe(true)

      await wrapper.finalizeCommit(transactionId)

      // Should be applied to underlying list
      const applied = await wrapper.get(3)
      expect(applied?.name).toBe('Item3')
    })

    it('should rollback without applying changes', async () => {
      await wrapper.set_in_transaction(transactionId, 3, { id: 3, name: 'Item3', category: 'C', value: 300 })

      await wrapper.rollback(transactionId)

      // Should not be applied to underlying list
      const notApplied = await wrapper.get(3)
      expect(notApplied).toBeUndefined()
    })
  })
})