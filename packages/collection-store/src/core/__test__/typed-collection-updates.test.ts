import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { TypedCollection, createTypedCollection } from '../TypedCollection'
import { TypedSchemaDefinition } from '../../types/typed-schema'
import { Item } from '../../types/Item'
import { List } from '../../storage/List'
import AdapterMemory from '../../storage/adapters/AdapterMemory'
import { cleanupTestDirectory, cleanupTestDirectories, createTestDir } from '../../utils/test-utils'

// Test interfaces
interface User extends Item {
  id: number
  name: string
  email: string
  age: number
  isActive: boolean
  tags: string[]
  profile: {
    bio: string
    settings: {
      notifications: boolean
      theme: 'light' | 'dark'
    }
  }
  createdAt: Date
}

interface Product extends Item {
  id: string
  name: string
  price: number
  category: string
  inStock: boolean
  rating?: number
}

// Test schemas without unique constraints to avoid conflicts
const testUserSchema: TypedSchemaDefinition<User> = {
  id: {
    type: 'int',
    required: true,
    index: true // No unique constraint
  },
  name: {
    type: 'string',
    required: true,
    index: true
  },
  email: {
    type: 'string',
    required: true,
    // No unique constraint for test isolation
    validator: (email: string) => email.includes('@')
  },
  age: {
    type: 'int',
    required: true,
    validator: (age: number) => age >= 0 && age <= 150
  },
  isActive: {
    type: 'boolean',
    required: true,
    default: true
  },
  tags: {
    type: 'array',
    default: []
  },
  'profile.bio': {
    type: 'string',
    default: ''
  },
  'profile.settings.notifications': {
    type: 'boolean',
    default: true
  },
  'profile.settings.theme': {
    type: 'string',
    default: 'light'
  },
  createdAt: {
    type: 'date',
    required: true,
    default: new Date()
  }
}

const testProductSchema: TypedSchemaDefinition<Product> = {
  id: {
    type: 'string',
    required: true,
    index: true // No unique constraint
  },
  name: {
    type: 'string',
    required: true,
    index: true
  },
  price: {
    type: 'double',
    required: true,
    validator: (price: number) => price >= 0
  },
  category: {
    type: 'string',
    required: true,
    index: true
  },
  inStock: {
    type: 'boolean',
    required: true,
    default: true
  },
  rating: {
    type: 'double',
    validator: (rating: number | undefined) => rating === undefined || (rating >= 0 && rating <= 5)
  }
}

describe('TypedCollection Type-safe Update Operations', () => {
  let userCollection: TypedCollection<User, typeof testUserSchema>
  let productCollection: TypedCollection<Product, typeof testProductSchema>
  let testDir: string

  beforeEach(async () => {
    testDir = createTestDir('typed-collection-updates')

    userCollection = createTypedCollection({
      name: 'test-users-updates-separate',
      schema: testUserSchema,
      root: testDir,
      list: new List<User>(),
      adapter: new AdapterMemory<User>(),
      schemaOptions: { coerceTypes: true, validateRequired: true }
    })

    productCollection = createTypedCollection({
      name: 'test-products-updates-separate',
      schema: testProductSchema,
      root: testDir,
      list: new List<Product>(),
      adapter: new AdapterMemory<Product>(),
      schemaOptions: { coerceTypes: true, validateRequired: true }
    })

    // Insert test data
    await userCollection.insert({
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      age: 30,
      isActive: true,
      tags: ['developer', 'typescript'],
      profile: {
        bio: 'Software developer',
        settings: {
          notifications: true,
          theme: 'light'
        }
      },
      createdAt: new Date('2023-01-01')
    })

    await productCollection.insert({
      id: 'prod-1',
      name: 'Laptop',
      price: 999.99,
      category: 'electronics',
      inStock: true,
      rating: 4.5
    })
  })

  afterEach(async () => {
    await userCollection.reset()
    await productCollection.reset()
    await cleanupTestDirectory(testDir)
  })

  describe('Atomic Update Operations', () => {
    test('should perform atomic update with $set operator', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $set: {
            age: 31,
            'profile.bio': 'Senior Software Developer'
          }
        }
      })

      expect(result.matchedCount).toBe(1)
      expect(result.modifiedCount).toBe(1)
      expect(result.modifiedDocuments).toHaveLength(1)
      expect(result.modifiedDocuments[0].age).toBe(31)
    })

    test('should perform atomic update with $inc operator', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $inc: { age: 5 }
        }
      })

      expect(result.modifiedDocuments[0].age).toBe(35)
    })

    test('should perform atomic update with $mul operator', async () => {
      const result = await productCollection.updateAtomic({
        filter: { id: 'prod-1' },
        update: {
          $mul: { price: 0.9 } // 10% discount
        }
      })

      expect(result.modifiedDocuments[0].price).toBeCloseTo(899.99, 2)
    })

    test('should perform atomic update with $min and $max operators', async () => {
      // Test $min operator - should update since 25 < 30
      await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $min: { age: 25 }
        }
      })

      let user = await userCollection.findById(1)
      expect(user?.age).toBe(25) // Should be updated to 25

      // Test $max operator - should update since 35 > 25
      await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $max: { age: 35 }
        }
      })

      user = await userCollection.findById(1)
      expect(user?.age).toBe(35) // Should be updated to 35

      // Test $min operator again - should not update since 40 > 35
      await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $min: { age: 40 }
        }
      })

      user = await userCollection.findById(1)
      expect(user?.age).toBe(35) // Should remain 35

      // Test $max operator again - should not update since 30 < 35
      await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $max: { age: 30 }
        }
      })

      user = await userCollection.findById(1)
      expect(user?.age).toBe(35) // Should remain 35
    })

    test('should perform atomic update with $currentDate operator', async () => {
      const beforeUpdate = new Date()

      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $currentDate: {
            createdAt: true
          }
        }
      })

      const afterUpdate = new Date()
      const updatedDate = result.modifiedDocuments[0].createdAt

      expect(updatedDate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      expect(updatedDate.getTime()).toBeLessThanOrEqual(afterUpdate.getTime())
    })

    test('should perform atomic update with $unset operator', async () => {
      const result = await productCollection.updateAtomic({
        filter: { id: 'prod-1' },
        update: {
          $unset: { rating: true }
        }
      })

      expect(result.modifiedDocuments[0].rating).toBeUndefined()
    })
  })

  describe('Array Update Operations', () => {
    test('should perform $addToSet operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $addToSet: {
            tags: 'javascript' // Add new tag
          }
        }
      })

      expect(result.modifiedDocuments[0].tags).toContain('javascript')
      expect(result.modifiedDocuments[0].tags).toHaveLength(3)

      // Try to add duplicate - should not add
      await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $addToSet: {
            tags: 'typescript' // Already exists
          }
        }
      })

      const user = await userCollection.findById(1)
      expect(user?.tags.filter(tag => tag === 'typescript')).toHaveLength(1)
    })

    test('should perform $push operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $push: {
            tags: 'python'
          }
        }
      })

      expect(result.modifiedDocuments[0].tags).toContain('python')
      expect(result.modifiedDocuments[0].tags).toHaveLength(3)
    })

    test('should perform $pull operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $pull: {
            tags: 'typescript'
          }
        }
      })

      expect(result.modifiedDocuments[0].tags).not.toContain('typescript')
      expect(result.modifiedDocuments[0].tags).toHaveLength(1)
    })

    test('should perform $pop operation', async () => {
      // Add more tags first
      await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $push: {
            tags: { $each: ['react', 'vue'] }
          }
        }
      })

      // Pop last element
      const result1 = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $pop: { tags: 1 }
        }
      })

      expect(result1.modifiedDocuments[0].tags).not.toContain('vue')

      // Pop first element
      const result2 = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          $pop: { tags: -1 }
        }
      })

      expect(result2.modifiedDocuments[0].tags).not.toContain('developer')
    })
  })

  describe('Mixed Update Operations', () => {
    test('should handle mixed direct and operator updates', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 1 },
        update: {
          name: 'Alice Updated', // Direct field update
          $inc: { age: 2 },      // Operator update
          $push: { tags: 'senior' } // Array operator
        }
      })

      const user = result.modifiedDocuments[0]
      expect(user.name).toBe('Alice Updated')
      expect(user.age).toBe(32)
      expect(user.tags).toContain('senior')
    })
  })
})

// Global cleanup after all tests
afterAll(async () => {
  await cleanupTestDirectories([
    './test-data-users-updates',
    './test-data-products-updates'
  ])
})