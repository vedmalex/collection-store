import { describe, test, expect } from 'bun:test'
import Collection from '../collection'
import { List } from '../storage/List'
import AdapterMemory from '../AdapterMemory'

interface TestProduct {
  id: number
  name: string
  price: number
  rating: number
  category: string
  createdAt: Date
}

describe('Single Key Sort Order in Collection Configuration', () => {
  test('should create collection with sort order specified in indexList', () => {
    const collection = Collection.create<TestProduct>({
      name: 'test_products',
      id: 'id',
      root: './data/',
      list: new List<TestProduct>(),
      adapter: new AdapterMemory<TestProduct>(),
      indexList: [
        { key: 'price', order: 'asc' },
        { key: 'rating', order: 'desc' },
        { key: 'name', order: 'asc' },
        { key: 'category', order: 'desc' },
        { key: 'createdAt', sparse: true, order: 'desc' }
      ]
    })

    // Check that order is properly stored in indexDefs
    expect(collection.indexDefs.price.order).toBe('asc')
    expect(collection.indexDefs.rating.order).toBe('desc')
    expect(collection.indexDefs.name.order).toBe('asc')
    expect(collection.indexDefs.category.order).toBe('desc')
    expect(collection.indexDefs.createdAt.order).toBe('desc')
    expect(collection.indexDefs.createdAt.sparse).toBe(true)
  })

  test('should handle default order when not specified', () => {
    const collection = Collection.create<TestProduct>({
      name: 'test_products_default',
      id: 'id',
      root: './data/',
      list: new List<TestProduct>(),
      adapter: new AdapterMemory<TestProduct>(),
      indexList: [
        { key: 'price' }, // No order specified
        { key: 'rating', order: 'desc' }
      ]
    })

    // Check that default order is undefined (handled by SingleKeyUtils)
    expect(collection.indexDefs.price.order).toBeUndefined()
    expect(collection.indexDefs.rating.order).toBe('desc')
  })

  test('should work with actual data and sorting', async () => {
    const collection = Collection.create<TestProduct>({
      name: 'test_products_data',
      id: 'id',
      root: './data/',
      list: new List<TestProduct>(),
      adapter: new AdapterMemory<TestProduct>(),
      indexList: [
        { key: 'price', order: 'asc' },
        { key: 'rating', order: 'desc' },
        { key: 'name', order: 'asc' }
      ]
    })

    // Add test data
    const products: TestProduct[] = [
      {
        id: 1,
        name: 'Laptop',
        price: 1200,
        rating: 4.5,
        category: 'Electronics',
        createdAt: new Date('2023-01-01')
      },
      {
        id: 2,
        name: 'Mouse',
        price: 25,
        rating: 4.2,
        category: 'Accessories',
        createdAt: new Date('2023-01-02')
      },
      {
        id: 3,
        name: 'Keyboard',
        price: 80,
        rating: 4.7,
        category: 'Accessories',
        createdAt: new Date('2023-01-03')
      }
    ]

    for (const product of products) {
      await collection.create(product)
    }

    // Test findBy with specific values
    const laptops = await collection.findBy('name' as any, 'Laptop')
    expect(laptops).toHaveLength(1)
    expect(laptops[0].name).toBe('Laptop')

    const highRated = await collection.findBy('rating' as any, 4.7)
    expect(highRated).toHaveLength(1)
    expect(highRated[0].name).toBe('Keyboard')

    const cheapItems = await collection.findBy('price' as any, 25)
    expect(cheapItems).toHaveLength(1)
    expect(cheapItems[0].name).toBe('Mouse')
  })

    test('should serialize and deserialize sort order correctly', () => {
    const collection = Collection.create<TestProduct>({
      name: 'test_products_serialize',
      id: 'id',
      root: './data/',
      list: new List<TestProduct>(),
      adapter: new AdapterMemory<TestProduct>(),
      indexList: [
        { key: 'price', order: 'asc' },
        { key: 'rating', order: 'desc' }
      ]
    })

    // Get serialized config
    const config = collection.config

    // Check that order is preserved in serialization
    const priceIndex = config.indexList.find(idx => idx.key === 'price')
    const ratingIndex = config.indexList.find(idx => idx.key === 'rating')

    expect(priceIndex?.order).toBe('asc')
    expect(ratingIndex?.order).toBe('desc')
  })

  test('should not apply sort order to composite indexes', () => {
    const collection = Collection.create<TestProduct>({
      name: 'test_products_composite',
      id: 'id',
      root: './data/',
      list: new List<TestProduct>(),
      adapter: new AdapterMemory<TestProduct>(),
            indexList: [
        { key: 'price', order: 'asc' }, // Single key with order
        { keys: ['category', 'price'] }, // Composite key - order should be ignored
        {
          composite: {
            keys: ['category', 'rating']
          }
        } // Composite key
      ]
    })

    // Single key should have order
    expect(collection.indexDefs.price.order).toBe('asc')

        // Composite indexes should not have top-level order
    const compositeIndex1 = collection.indexDefs['category,price']
    const compositeIndex2 = collection.indexDefs['category,rating']

    expect(compositeIndex1.order).toBeUndefined()
    expect(compositeIndex2.order).toBeUndefined()

    // But composite should have its own structure
    expect(compositeIndex1.keys).toBeDefined()
    expect(compositeIndex2.composite).toBeDefined()
  })

  test('should handle mixed index configurations', () => {
    const collection = Collection.create<TestProduct>({
      name: 'test_products_mixed',
      id: 'id',
      root: './data/',
      list: new List<TestProduct>(),
      adapter: new AdapterMemory<TestProduct>(),
      indexList: [
        { key: 'price', order: 'asc', unique: false },
        { key: 'name', order: 'desc', sparse: true },
        { key: 'rating', unique: true }, // No order specified
        { keys: ['category', 'price'] }, // Composite
        { key: 'createdAt', sparse: true, order: 'desc' }
      ]
    })

    // Check all configurations are preserved
    expect(collection.indexDefs.price.order).toBe('asc')
    expect(collection.indexDefs.price.unique).toBe(false)

    expect(collection.indexDefs.name.order).toBe('desc')
    expect(collection.indexDefs.name.sparse).toBe(true)

    expect(collection.indexDefs.rating.order).toBeUndefined()
    expect(collection.indexDefs.rating.unique).toBe(true)

    expect(collection.indexDefs.createdAt.order).toBe('desc')
    expect(collection.indexDefs.createdAt.sparse).toBe(true)

    // Composite should not have order
    expect(collection.indexDefs['category,price'].order).toBeUndefined()
    expect(collection.indexDefs['category,price'].keys).toBeDefined()
  })
})