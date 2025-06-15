import Collection from '../core/Collection'
import AdapterMemory from '../storage/adapters/AdapterMemory'
import { List } from '../storage/List'
import { Item } from '../types/Item'
import { cleanupTestDirectory, createTestDir } from './test-utils'

interface TestItem extends Item {
  id?: number
  name: string
  value?: number
}

interface TestItemCustomId extends Item {
  customId?: number
  name: string
  value?: number
}

describe('AutoInc and Default Index Tests', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir('autoinc-test')
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  describe('✅ AutoInc ID Generation', () => {
    it('should auto-generate sequential IDs when auto is true', async () => {
      const collection = Collection.create<TestItem>({
        name: 'test-autoinc',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
        // Default config should have auto: true and gen: 'autoIncIdGen'
      })

      // Insert items without providing ID
      const item1 = await collection.create({ name: 'first' })
      const item2 = await collection.create({ name: 'second' })
      const item3 = await collection.create({ name: 'third' })

      // Verify auto-generated IDs are sequential
      expect(item1?.id).toBe(0)
      expect(item2?.id).toBe(1)
      expect(item3?.id).toBe(2)

      // Verify counter is updated correctly
      expect(collection.list.counter).toBe(3)
    })

    it('should use provided ID when auto is false', async () => {
      const collection = Collection.create<TestItem>({
        name: 'test-manual-id',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
        id: {
          name: 'id',
          auto: false,
        },
      })

      // Insert items with manual IDs
      const item1 = await collection.create({ id: 100, name: 'first' })
      const item2 = await collection.create({ id: 200, name: 'second' })

      expect(item1?.id).toBe(100)
      expect(item2?.id).toBe(200)
    })

    it('should handle custom ID field name with autoinc', async () => {
      const collection = Collection.create<TestItemCustomId>({
        name: 'test-custom-id',
        root: testDir,
        list: new List<TestItemCustomId>(),
        adapter: new AdapterMemory<TestItemCustomId>(),
        id: {
          name: 'customId',
          auto: true,
          gen: 'autoIncIdGen',
        },
      })

      const item1 = await collection.create({ name: 'first' })
      const item2 = await collection.create({ name: 'second' })

      expect(item1?.customId).toBe(0)
      expect(item2?.customId).toBe(1)
      expect(collection.id).toBe('customId')
    })
  })

  describe('✅ Default Index Creation', () => {
    it('should automatically create unique required index for ID field', () => {
      const collection = Collection.create<TestItem>({
        name: 'test-default-index',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
      })

      // Check that default ID index is created
      expect(collection.indexDefs).toHaveProperty('id')

      const idIndexDef = collection.indexDefs['id']
      expect(idIndexDef.key).toBe('id')
      expect(idIndexDef.auto).toBe(true)
      expect(idIndexDef.unique).toBe(true)
      expect(idIndexDef.sparse).toBe(false)
      expect(idIndexDef.required).toBe(true)
      expect(idIndexDef.gen).toBeDefined()
    })

    it('should create index with custom ID field name', () => {
      const collection = Collection.create<TestItemCustomId>({
        name: 'test-custom-index',
        root: testDir,
        list: new List<TestItemCustomId>(),
        adapter: new AdapterMemory<TestItemCustomId>(),
        id: {
          name: 'customId',
          auto: true,
          gen: 'autoIncIdGen',
        },
      })

      // Check that custom ID index is created
      expect(collection.indexDefs).toHaveProperty('customId')

      const customIdIndexDef = collection.indexDefs['customId']
      expect(customIdIndexDef.key).toBe('customId')
      expect(customIdIndexDef.auto).toBe(true)
      expect(customIdIndexDef.unique).toBe(true)
      expect(customIdIndexDef.required).toBe(true)
    })

    it('should not override explicitly provided index for ID field', () => {
      const collection = Collection.create<TestItem>({
        name: 'test-explicit-index',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
        indexList: [
          {
            key: 'id',
            auto: false,
            unique: false,
            sparse: true,
            required: false,
          },
        ],
      })

      // The explicit index should override the default
      const idIndexDef = collection.indexDefs['id']
      expect(idIndexDef.auto).toBe(false)
      expect(idIndexDef.unique).toBe(false)
      expect(idIndexDef.sparse).toBe(true)
      expect(idIndexDef.required).toBe(false)
    })
  })

  describe('✅ Edge Cases and Error Handling', () => {
    it('should handle missing name in config', () => {
      expect(() => {
        Collection.create<TestItem>({
          // name is missing
          root: testDir,
          list: new List<TestItem>(),
          adapter: new AdapterMemory<TestItem>(),
        } as any)
      }).toThrow('must Have Model Name as "name" prop in config')
    })

    it('should use default values when config is minimal', () => {
      const collection = Collection.create<TestItem>({
        name: 'test-minimal',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
      })

      expect(collection.id).toBe('id')
      expect(collection.auto).toBe(true)
      expect(collection.indexDefs['id'].gen).toBeDefined()
    })

    it('should handle string ID configuration', () => {
      const collection = Collection.create<TestItem>({
        name: 'test-string-id',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
        id: 'myId',
      })

      expect(collection.id).toBe('myId')
      expect(collection.auto).toBe(true)
      expect(collection.indexDefs).toHaveProperty('myId')
    })
  })

  describe('✅ Integration with Indexes', () => {
    it('should work correctly with additional indexes', async () => {
      const collection = Collection.create<TestItem>({
        name: 'test-with-indexes',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
        indexList: [
          { key: 'name', unique: true },
          { key: 'value' },
        ],
      })

      // Should have default ID index plus additional indexes
      expect(collection.indexDefs).toHaveProperty('id')
      expect(collection.indexDefs).toHaveProperty('name')
      expect(collection.indexDefs).toHaveProperty('value')

      // Test that all indexes work
      const item = await collection.create({ name: 'test', value: 42 })
      expect(item?.id).toBe(0)

      const foundById = await collection.findById(0)
      expect(foundById?.name).toBe('test')

      const foundByName = await collection.findFirstBy('name', 'test')
      expect(foundByName?.id).toBe(0)
    })

    it('should maintain index consistency during operations', async () => {
      const collection = Collection.create<TestItem>({
        name: 'test-consistency',
        root: testDir,
        list: new List<TestItem>(),
        adapter: new AdapterMemory<TestItem>(),
      })

      // Create multiple items
      await collection.create({ name: 'item1' })
      await collection.create({ name: 'item2' })
      await collection.create({ name: 'item3' })

      // Verify all items can be found by ID
      const item1 = await collection.findById(0)
      const item2 = await collection.findById(1)
      const item3 = await collection.findById(2)

      expect(item1?.name).toBe('item1')
      expect(item2?.name).toBe('item2')
      expect(item3?.name).toBe('item3')

      // Verify counter is correct
      expect(collection.list.counter).toBe(3)
    })
  })
})