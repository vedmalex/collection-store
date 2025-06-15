import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import Collection from '../../../core/Collection'
import { CSDatabase } from '../../../core/Database'
import AdapterMemory from '../../../storage/adapters/AdapterMemory'
import AdapterFile from '../../../storage/adapters/AdapterFile'
import { List } from '../../../storage/List'
import { Item } from '../types/Item'
import { cleanupTestDirectories } from '../../test-utils'

interface TestItem extends Item {
  id?: number
  name: string
  value?: number
}

// Глобальный счетчик для уникальных имен
let testCounter = 0

describe('Memory Adapter Selection Tests', () => {
  let testId: number

  beforeEach(() => {
    testId = ++testCounter
  })

  describe('✅ CSDatabase dbName: ":memory:" Support', () => {
    it('should use AdapterMemory when dbName is ":memory:"', async () => {
      const db = new CSDatabase(':memory:', `test-memory-db-${testId}`)
      await db.connect()

      const collection = await db.createCollection<TestItem>(`test-collection-${testId}`)

      // Check that the collection uses AdapterMemory
      expect((collection as any).storage.name).toBe('AdapterMemory')
      expect((collection as any).storage).toBeInstanceOf(AdapterMemory)

      // Cleanup
      await db.clearCollections()
    })

    it('should use AdapterFile when dbName is not ":memory:"', async () => {
      const db = new CSDatabase(`./test-data-${testId}`, `test-file-db-${testId}`)
      await db.connect()

      const collection = await db.createCollection<TestItem>(`test-collection-${testId}`)

      // Check that the collection uses AdapterFile
      expect((collection as any).storage.name).toBe('AdapterFile')
      expect((collection as any).storage).toBeInstanceOf(AdapterFile)

      // Cleanup
      await db.clearCollections()
    })

    it('should work correctly with in-memory collections', async () => {
      const db = new CSDatabase(':memory:', `test-memory-operations-${testId}`)
      await db.connect()

      const collection = await db.createCollection<TestItem>(`users-${testId}`)

      // Test basic operations
      const user1 = await collection.create({ name: 'Alice', value: 100 })
      const user2 = await collection.create({ name: 'Bob', value: 200 })

      expect(user1?.id).toBe(0)
      expect(user2?.id).toBe(1)

      const allUsers = await collection.find({})
      expect(allUsers).toHaveLength(2)
      expect(allUsers[0].name).toBe('Alice')
      expect(allUsers[1].name).toBe('Bob')

      // Verify data is in memory (not persisted to disk)
      expect((collection as any).storage.name).toBe('AdapterMemory')

      // Cleanup
      await db.clearCollections()
    })

    it('should handle multiple collections in memory database', async () => {
      const db = new CSDatabase(':memory:', `multi-collection-test-${testId}`)
      await db.connect()

      const users = await db.createCollection<TestItem>(`users-${testId}`)
      const products = await db.createCollection<TestItem>(`products-${testId}`)

      // Both should use memory adapter
      expect((users as any).storage.name).toBe('AdapterMemory')
      expect((products as any).storage.name).toBe('AdapterMemory')

      // Test operations on both collections
      await users.create({ name: 'User1', value: 1 })
      await products.create({ name: 'Product1', value: 100 })

      const userCount = (await users.find({})).length
      const productCount = (await products.find({})).length

      expect(userCount).toBe(1)
      expect(productCount).toBe(1)

      // Cleanup
      await db.clearCollections()
    })
  })

  describe('✅ Collection.create() dbName Support', () => {
    it('should support dbName option in Collection.create()', () => {
      const collection = Collection.create<TestItem>({
        name: `test-memory-collection-${testId}`,
        dbName: ':memory:',
        list: new List<TestItem>(),
      })

      // Should automatically use AdapterMemory
      expect(collection.storage.name).toBe('AdapterMemory')
      expect(collection.storage).toBeInstanceOf(AdapterMemory)
    })

    it('should use AdapterMemory when dbName is not ":memory:"', () => {
      const collection = Collection.create<TestItem>({
        name: `test-file-collection-${testId}`,
        dbName: './test-data/my-db',
        list: new List<TestItem>(),
      })

      // Should use AdapterMemory (default behavior)
      expect(collection.storage.name).toBe('AdapterMemory')
      expect(collection.storage).toBeInstanceOf(AdapterMemory)
    })

    it('should use default adapter when dbName is not specified', () => {
      const collection = Collection.create<TestItem>({
        name: `test-default-collection-${testId}`,
        root: './test-data',
        list: new List<TestItem>(),
      })

      // Should use default AdapterMemory
      expect(collection.storage.name).toBe('AdapterMemory')
      expect(collection.storage).toBeInstanceOf(AdapterMemory)
    })
  })

  describe('✅ MikroORM Convention Compatibility', () => {
    it('should follow MikroORM convention for :memory: databases', async () => {
      // This mimics MikroORM's approach where dbName: ':memory:'
      // automatically uses in-memory storage
      const memoryDb = new CSDatabase(':memory:', `memory-convention-${testId}`)
      await memoryDb.connect()

      const collection = await memoryDb.createCollection<TestItem>(`test-memory-convention-${testId}`)

      // Verify it behaves like MikroORM's in-memory database
      expect((collection as any).storage.name).toBe('AdapterMemory')

      // Test that data doesn't persist between instances
      await collection.create({ name: 'temp-data' })
      expect((await collection.find({})).length).toBe(1)

      // Create new instance - should be empty (in-memory behavior)
      const newMemoryDb = new CSDatabase(':memory:', `memory-convention-new-${testId}`)
      await newMemoryDb.connect()
      const newCollection = await newMemoryDb.createCollection<TestItem>(`test-memory-convention-new-${testId}`)

      expect((await newCollection.find({})).length).toBe(0)

      // Cleanup
      await memoryDb.clearCollections()
      await newMemoryDb.clearCollections()
    })

    it('should support different memory database names', async () => {
      const db1 = new CSDatabase(':memory:', `db1-${testId}`)
      const db2 = new CSDatabase(':memory:', `db2-${testId}`)

      await db1.connect()
      await db2.connect()

      const collection1 = await db1.createCollection<TestItem>(`test-${testId}-1`)
      const collection2 = await db2.createCollection<TestItem>(`test-${testId}-2`)

      // Both should use memory adapters
      expect((collection1 as any).storage.name).toBe('AdapterMemory')
      expect((collection2 as any).storage.name).toBe('AdapterMemory')

      // Data should be isolated
      await collection1.create({ name: 'data1' })
      await collection2.create({ name: 'data2' })

      expect((await collection1.find({}))[0].name).toBe('data1')
      expect((await collection2.find({}))[0].name).toBe('data2')
      expect((await collection1.find({})).length).toBe(1)
      expect((await collection2.find({})).length).toBe(1)

      // Cleanup
      await db1.clearCollections()
      await db2.clearCollections()
    })
  })
})

// Global cleanup after all tests
afterAll(async () => {
  // Clean up any test-data directories that might have been created
  const testDataDirs: string[] = []
  for (let i = 1; i <= testCounter; i++) {
    testDataDirs.push(`./test-data-${i}`)
  }
  await cleanupTestDirectories(testDataDirs)
})