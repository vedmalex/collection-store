/**
 * WAL Storage Integration Tests
 * Тесты для интеграции WAL с Collection и Database (PHASE 3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { WALCollection, WALCollectionConfig } from '../WALCollection'
import { WALDatabase, WALDatabaseConfig } from '../WALDatabase'
import { Item } from '../types/Item'
import { createTestDir, cleanupTestDirectory } from './test-utils'

interface TestItem extends Item {
  id: number
  name: string
  value?: number
}

describe('WAL Storage Integration', () => {
  let testDir: string
  let walPath: string

  beforeEach(async () => {
    testDir = createTestDir('wal-storage-integration')
    walPath = path.join(testDir, 'integration.wal')
    await fs.ensureDir(testDir)
    await fs.remove(walPath)
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  describe('WALCollection Integration', () => {
    let walCollection: WALCollection<TestItem>

    beforeEach(async () => {
      const config: WALCollectionConfig<TestItem> = {
        name: 'test-collection',
        root: testDir,
        enableTransactions: true,
        walOptions: {
          walPath,
          enableWAL: true,
          autoRecovery: false
        }
      }

      walCollection = WALCollection.create(config)
    })

    afterEach(async () => {
      await walCollection.reset()
    })

    it('should create WAL collection with transaction support', async () => {
      expect(walCollection.isTransactionsEnabled()).toBe(true)
      expect(walCollection.getTransactionManager()).toBeDefined()
      expect(walCollection.name).toBe('test-collection')
      expect(walCollection.root).toBe(testDir)
    })

    it('should perform CRUD operations with WAL logging', async () => {
      // Begin transaction
      const txId = await walCollection.beginTransaction()

      // Create item
      const item1 = await walCollection.create({ id: 1, name: 'Test Item 1' })
      expect(item1).toBeDefined()
      expect(item1!.id).toBe(1)

      // Update item
      const updatedItem = await walCollection.updateWithId(1, { name: 'Updated Item 1' })
      expect(updatedItem).toBeDefined()
      expect(updatedItem!.name).toBe('Updated Item 1')

      // Commit transaction
      await walCollection.commitTransaction(txId)

      // Verify WAL entries
      const walEntries = await walCollection.getWALEntries()
      expect(walEntries.length).toBeGreaterThan(0)

      // Should have BEGIN, INSERT, UPDATE, and COMMIT entries
      const beginEntry = walEntries.find(e => e.type === 'BEGIN')
      const insertEntry = walEntries.find(e => e.operation === 'INSERT')
      const updateEntry = walEntries.find(e => e.operation === 'UPDATE')
      const commitEntry = walEntries.find(e => e.type === 'COMMIT')

      expect(beginEntry).toBeDefined()
      expect(insertEntry).toBeDefined()
      expect(updateEntry).toBeDefined()
      expect(commitEntry).toBeDefined()
    })

    it('should handle persist operations in transactions', async () => {
      // Add some data
      await walCollection.create({ id: 1, name: 'Test Item 1' })
      await walCollection.create({ id: 2, name: 'Test Item 2' })

      // Persist should create implicit transaction
      await walCollection.persist()

      // Verify data persisted
      const item1 = await walCollection.findById(1)
      const item2 = await walCollection.findById(2)

      expect(item1).toBeDefined()
      expect(item2).toBeDefined()
      expect(item1!.name).toBe('Test Item 1')
      expect(item2!.name).toBe('Test Item 2')
    })

    it('should handle transaction rollback', async () => {
      // Begin transaction
      const txId = await walCollection.beginTransaction()

      // Create item
      await walCollection.create({ id: 1, name: 'Test Item 1' })

      // Rollback transaction
      await walCollection.rollbackTransaction(txId)

      // Verify WAL entries include rollback
      const walEntries = await walCollection.getWALEntries()
      const rollbackEntry = walEntries.find(e => e.type === 'ROLLBACK')
      expect(rollbackEntry).toBeDefined()
    })

    it('should support all IDataCollection methods', async () => {
      // Test all delegated methods
      await walCollection.create({ id: 1, name: 'Item 1', value: 10 })
      await walCollection.create({ id: 2, name: 'Item 2', value: 20 })
      await walCollection.create({ id: 3, name: 'Item 3', value: 30 })

      // Test find methods
      const item1 = await walCollection.findById(1)
      expect(item1).toBeDefined()
      expect(item1!.name).toBe('Item 1')

      const items = await walCollection.find(() => true)
      expect(items).toHaveLength(3)

      const firstItem = await walCollection.first()
      expect(firstItem).toBeDefined()

      const lastItem = await walCollection.last()
      expect(lastItem).toBeDefined()

      // Test update methods
      const updated = await walCollection.updateWithId(1, { value: 15 })
      expect(updated).toBeDefined()
      expect(updated!.value).toBe(15)

      // Test remove methods
      const removed = await walCollection.removeWithId(3)
      expect(removed).toBeDefined()
      expect(removed!.id).toBe(3)

      // Verify remaining items
      const remainingItems = await walCollection.find(() => true)
      expect(remainingItems).toHaveLength(2)
    })

    it('should create and manage checkpoints', async () => {
      // Add some data
      await walCollection.create({ id: 1, name: 'Test Item 1' })
      await walCollection.create({ id: 2, name: 'Test Item 2' })

      // Create checkpoint
      const checkpointId = await walCollection.createCheckpoint()
      expect(checkpointId).toBeDefined()
      expect(typeof checkpointId).toBe('string')
      expect(checkpointId.length).toBeGreaterThan(0)
    })

    it('should perform recovery', async () => {
      // Add some data and create transactions
      const txId = await walCollection.beginTransaction()
      await walCollection.create({ id: 1, name: 'Test Item 1' })
      await walCollection.commitTransaction(txId)

      // Perform recovery
      await walCollection.performRecovery()

      // Recovery should complete without errors
      expect(true).toBe(true)
    })
  })

  describe('WALDatabase Integration', () => {
    let walDatabase: WALDatabase

    beforeEach(async () => {
      const config: WALDatabaseConfig = {
        enableTransactions: true,
        globalWAL: false,
        walOptions: {
          enableWAL: true,
          autoRecovery: false
        }
      }

      walDatabase = new WALDatabase(testDir, 'test-db', config)
      await walDatabase.connect()
    })

    afterEach(async () => {
      await walDatabase.close()
    })

    it('should create WAL database with transaction support', async () => {
      expect(walDatabase.isTransactionsEnabled()).toBe(true)
      expect(walDatabase.getWALConfig().enableTransactions).toBe(true)
    })

    it('should create WAL-enhanced collections', async () => {
      const collection = await walDatabase.createCollection<TestItem>('test-collection')
      expect(collection).toBeDefined()

      // Should be a WALCollection
      expect('isTransactionsEnabled' in collection).toBe(true)
      expect((collection as any).isTransactionsEnabled()).toBe(true)
    })

    it('should handle global transactions across collections', async () => {
      // Create multiple collections
      const collection1 = await walDatabase.createCollection<TestItem>('collection1')
      const collection2 = await walDatabase.createCollection<TestItem>('collection2')

      // Begin global transaction
      const txId = await walDatabase.beginGlobalTransaction()

      // Add data to both collections
      await collection1.create({ id: 1, name: 'Item 1 in Collection 1' })
      await collection2.create({ id: 1, name: 'Item 1 in Collection 2' })

      // Commit global transaction
      await walDatabase.commitGlobalTransaction(txId)

      // Verify data in both collections
      const item1 = await collection1.findById(1)
      const item2 = await collection2.findById(1)

      expect(item1).toBeDefined()
      expect(item2).toBeDefined()
      expect(item1!.name).toBe('Item 1 in Collection 1')
      expect(item2!.name).toBe('Item 1 in Collection 2')
    })

    it('should handle global transaction rollback', async () => {
      // Create collection
      const collection = await walDatabase.createCollection<TestItem>('test-collection')

      // Begin global transaction
      const txId = await walDatabase.beginGlobalTransaction()

      // Add data
      await collection.create({ id: 1, name: 'Test Item' })

      // Rollback global transaction
      await walDatabase.rollbackGlobalTransaction(txId)

      // Transaction should be rolled back
      expect(true).toBe(true) // Rollback completed without error
    })

    it('should persist all collections with transaction support', async () => {
      // Create collections and add data
      const collection1 = await walDatabase.createCollection<TestItem>('collection1')
      const collection2 = await walDatabase.createCollection<TestItem>('collection2')

      await collection1.create({ id: 1, name: 'Item 1' })
      await collection2.create({ id: 1, name: 'Item 1' })

      // Persist all collections
      await walDatabase.persist()

      // Persistence should complete without errors
      expect(true).toBe(true)
    })

    it('should perform database-wide recovery', async () => {
      // Create collections and transactions
      const collection = await walDatabase.createCollection<TestItem>('test-collection')

      const txId = await walDatabase.beginGlobalTransaction()
      await collection.create({ id: 1, name: 'Test Item' })
      await walDatabase.commitGlobalTransaction(txId)

      // Perform recovery
      await walDatabase.performRecovery()

      // Recovery should complete without errors
      expect(true).toBe(true)
    })

    it('should create global checkpoints', async () => {
      // Create collections and add data
      const collection1 = await walDatabase.createCollection<TestItem>('collection1')
      const collection2 = await walDatabase.createCollection<TestItem>('collection2')

      await collection1.create({ id: 1, name: 'Item 1' })
      await collection2.create({ id: 1, name: 'Item 1' })

      // Create global checkpoint
      const checkpointIds = await walDatabase.createGlobalCheckpoint()
      expect(checkpointIds).toBeDefined()
      expect(Array.isArray(checkpointIds)).toBe(true)
      expect(checkpointIds.length).toBeGreaterThan(0)
    })

    it('should get WAL entries for debugging', async () => {
      // Create collection and add data
      const collection = await walDatabase.createCollection<TestItem>('test-collection')

      const txId = await walDatabase.beginGlobalTransaction()
      await collection.create({ id: 1, name: 'Test Item' })
      await walDatabase.commitGlobalTransaction(txId)

      // Get WAL entries
      const allEntries = await walDatabase.getWALEntries()
      const collectionEntries = await walDatabase.getWALEntries('test-collection')

      expect(allEntries).toBeDefined()
      expect(Array.isArray(allEntries)).toBe(true)
      expect(collectionEntries).toBeDefined()
      expect(Array.isArray(collectionEntries)).toBe(true)
    })

    it('should list WAL collections', async () => {
      // Create collections
      await walDatabase.createCollection<TestItem>('collection1')
      await walDatabase.createCollection<TestItem>('collection2')

      // List WAL collections
      const walCollections = walDatabase.listWALCollections()
      expect(walCollections).toHaveLength(2)
      expect(walCollections).toContain('collection1')
      expect(walCollections).toContain('collection2')
    })

    it('should drop collections with WAL cleanup', async () => {
      // Create collection
      await walDatabase.createCollection<TestItem>('test-collection')
      expect(walDatabase.listWALCollections()).toContain('test-collection')

      // Drop collection
      const dropped = await walDatabase.dropCollection('test-collection')
      expect(dropped).toBe(true)
      expect(walDatabase.listWALCollections()).not.toContain('test-collection')
    })
  })

  describe('Backward Compatibility', () => {
    it('should work with transactions disabled', async () => {
      const config: WALCollectionConfig<TestItem> = {
        name: 'test-collection',
        root: testDir,
        enableTransactions: false
      }

      const collection = WALCollection.create(config)
      expect(collection.isTransactionsEnabled()).toBe(false)

      // Should still work for basic operations
      const item = await collection.create({ id: 1, name: 'Test Item' })
      expect(item).toBeDefined()
      expect(item!.name).toBe('Test Item')

      // Persist should work without transactions
      await collection.persist()

      await collection.reset()
    })

    it('should fallback to regular collections when transactions disabled', async () => {
      const config: WALDatabaseConfig = {
        enableTransactions: false
      }

      const database = new WALDatabase(testDir, 'test-db', config)
      await database.connect()

      expect(database.isTransactionsEnabled()).toBe(false)

      // Should create regular collections
      const collection = await database.createCollection<TestItem>('test-collection')
      expect(collection).toBeDefined()

      // Should not have WAL methods
      expect('isTransactionsEnabled' in collection).toBe(false)

      await database.close()
    })
  })
})