import { describe, it, expect, beforeEach } from 'bun:test'
import Collection from '../collection'
import { CompositeKeyUtils } from '../utils/CompositeKeyUtils'
import { List } from '../storage/List'
import AdapterMemory from '../AdapterMemory'
import { tmpdir } from 'os'

interface TestItem {
  id: number
  category: string
  priority: string
  status: string
  createdAt: Date
  value: number
}

describe('Composite Index Integration Tests', () => {
  let collection: Collection<TestItem>

  beforeEach(async () => {
    collection = Collection.create<TestItem>({
      name: 'test-composite',
      root: tmpdir(),
      list: new List<TestItem>(),
      adapter: new AdapterMemory<TestItem>(),
      indexList: [
        {
          keys: ['category', 'priority'],
          unique: false,
          sparse: false
        },
        {
          keys: ['category', 'status', 'priority'],
          unique: false,
          sparse: false
        },
        {
          composite: {
            keys: ['priority', 'createdAt'],
            separator: '|'
          },
          unique: false,
          sparse: false
        }
      ]
    })
  })

  describe('Index Creation', () => {
    it('should create composite indexes with generated names', () => {
      const expectedIndexName1 = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const expectedIndexName2 = CompositeKeyUtils.generateIndexName(['category', 'status', 'priority'])
      const expectedIndexName3 = CompositeKeyUtils.generateIndexName(['priority', 'createdAt'])

      expect(collection.indexes[expectedIndexName1]).toBeDefined()
      expect(collection.indexes[expectedIndexName2]).toBeDefined()
      expect(collection.indexes[expectedIndexName3]).toBeDefined()
    })

    it('should store correct index definitions', () => {
      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const indexDef = collection.indexDefs[indexName]

      expect(indexDef.keys).toEqual(['category', 'priority'])
      expect(indexDef.key).toBeUndefined()
      expect(indexDef.process).toBeDefined()
    })

    it('should use custom separator for composite syntax', () => {
      const indexName = CompositeKeyUtils.generateIndexName(['priority', 'createdAt'])
      const indexDef = collection.indexDefs[indexName]

      expect(indexDef.composite?.separator).toBe('|')
    })
  })

  describe('CRUD Operations', () => {
    const testItems: TestItem[] = [
      {
        id: 1,
        category: 'bug',
        priority: 'high',
        status: 'open',
        createdAt: new Date('2024-01-01'),
        value: 100
      },
      {
        id: 2,
        category: 'bug',
        priority: 'low',
        status: 'closed',
        createdAt: new Date('2024-01-02'),
        value: 200
      },
      {
        id: 3,
        category: 'feature',
        priority: 'high',
        status: 'open',
        createdAt: new Date('2024-01-03'),
        value: 300
      }
    ]

    it('should insert items and create composite index entries', async () => {
      for (const item of testItems) {
        await collection.create(item)
      }

      expect(collection.list.length).toBe(3)

      // Check that composite indexes contain the items
      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const index = collection.indexes[indexName]

      // Should have entries for each unique composite key
      expect(index.size).toBeGreaterThan(0)
    })

    it('should find items by composite keys', async () => {
      for (const item of testItems) {
        await collection.create(item)
      }

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', 'high'])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe(1)
    })

    it('should find items by three-field composite keys', async () => {
      for (const item of testItems) {
        await collection.create(item)
      }

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'status', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', 'open', 'high'])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe(1)
    })

    it('should use custom separator in composite keys', async () => {
      for (const item of testItems) {
        await collection.create(item)
      }

      const indexName = CompositeKeyUtils.generateIndexName(['priority', 'createdAt'])
      const compositeKey = CompositeKeyUtils.serialize(['high', testItems[0].createdAt], '|')

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe(1)
    })

    it('should update items and maintain composite indexes', async () => {
      await collection.create(testItems[0])

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])

      // Check initial state
      let compositeKey = CompositeKeyUtils.serialize(['bug', 'high'])
      let found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)

      // Update the item
      await collection.updateWithId(1, { priority: 'medium' })

      // Old key should not exist
      found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(0)

      // New key should exist
      compositeKey = CompositeKeyUtils.serialize(['bug', 'medium'])
      found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].priority).toBe('medium')
    })

    it('should remove items and clean up composite indexes', async () => {
      await collection.create(testItems[0])

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', 'high'])

      // Check item exists
      let found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)

      // Remove the item
      await collection.removeWithId(1)

      // Item should not be found
      found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(0)
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      const items: TestItem[] = [
        { id: 1, category: 'bug', priority: 'high', status: 'open', createdAt: new Date('2024-01-01'), value: 100 },
        { id: 2, category: 'bug', priority: 'high', status: 'closed', createdAt: new Date('2024-01-02'), value: 200 },
        { id: 3, category: 'bug', priority: 'low', status: 'open', createdAt: new Date('2024-01-03'), value: 300 },
        { id: 4, category: 'feature', priority: 'high', status: 'open', createdAt: new Date('2024-01-04'), value: 400 },
      ]

      for (const item of items) {
        await collection.create(item)
      }
    })

    it('should find multiple items with same composite key', async () => {
      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', 'high'])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(2)
      expect(found.map(item => item.id).sort()).toEqual([1, 2])
    })

    it('should find first item by composite key', async () => {
      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', 'high'])

      const found = await collection.findFirstBy(indexName as any, compositeKey)
      expect(found).toBeDefined()
      expect([1, 2]).toContain(found!.id)
    })

    it('should find last item by composite key', async () => {
      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', 'high'])

      const found = await collection.findLastBy(indexName as any, compositeKey)
      expect(found).toBeDefined()
      expect([1, 2]).toContain(found!.id)
    })

    it('should return empty array for non-existent composite key', async () => {
      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['nonexistent', 'priority'])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null values in composite keys', async () => {
      const item = {
        id: 1,
        category: 'bug',
        priority: null as any,
        status: 'open',
        createdAt: new Date(),
        value: 100
      }

      await collection.create(item)

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', null])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe(1)
    })

    it('should handle undefined values in composite keys', async () => {
      const item = {
        id: 1,
        category: 'bug',
        priority: undefined as any,
        status: 'open',
        createdAt: new Date(),
        value: 100
      }

      await collection.create(item)

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug', undefined])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe(1)
    })

    it('should handle special characters in composite key values', async () => {
      const item = {
        id: 1,
        category: 'bug\u0000with\u0000nulls',
        priority: 'high|with|pipes',
        status: 'open',
        createdAt: new Date(),
        value: 100
      }

      await collection.create(item)

      const indexName = CompositeKeyUtils.generateIndexName(['category', 'priority'])
      const compositeKey = CompositeKeyUtils.serialize(['bug\u0000with\u0000nulls', 'high|with|pipes'])

      const found = await collection.findBy(indexName as any, compositeKey)
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe(1)
    })
  })
})