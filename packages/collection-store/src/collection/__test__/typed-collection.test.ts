// Tests for TypedCollection - demonstrating type safety and schema integration
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { TypedCollection, createTypedCollection } from '../../core/TypedCollection'
import { TypedSchemaDefinition, CompleteTypedSchema } from '../../types/typed-schema'
import { Item } from '../../types/Item'
import AdapterMemory from '../../storage/adapters/AdapterMemory'
import { List } from '../../storage/List'
import { cleanupTestDirectory, cleanupTestDirectories, createTestDir } from '../../utils/test-utils'

// Test data types
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

// Schema definitions
const userSchema: TypedSchemaDefinition<User> = {
  id: {
    type: 'int',
    required: true,
    index: { unique: true }
  },
  name: {
    type: 'string',
    required: true,
    index: true
  },
  email: {
    type: 'string',
    required: true,
    index: { unique: true },
    validator: (email: string) => email.includes('@')
  },
  age: {
    type: 'int',
    required: true,
    validator: (age: number) => age >= 0 && age <= 150,
    index: true
  },
  isActive: {
    type: 'boolean',
    default: true,
    index: true
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
    default: new Date('2023-01-01'),
    index: true
  }
}

const productSchema: CompleteTypedSchema<Product> = {
  fields: {
    id: {
      type: 'string',
      required: true,
      index: { unique: true }
    },
    name: {
      type: 'string',
      required: true,
      index: true
    },
    price: {
      type: 'double',
      required: true,
      validator: (price: number) => price > 0,
      index: true
    },
    category: {
      type: 'string',
      required: true,
      index: true
    },
    inStock: {
      type: 'boolean',
      default: true,
      index: true
    },
    rating: {
      type: 'double',
      validator: (rating: number | undefined) => rating === undefined || (rating >= 0 && rating <= 5)
    }
  },
  indexes: [
    {
      name: 'category_price',
      fields: [
        { field: 'category', order: 'asc' },
        { field: 'price', order: 'desc' }
      ]
    }
  ],
  options: {
    strict: false,
    coerceTypes: true
  }
}

// Schema for bulk tests without unique email constraint
const bulkUserSchema: TypedSchemaDefinition<User> = {
  id: {
    type: 'int',
    required: true,
    index: { unique: true }
  },
  name: {
    type: 'string',
    required: true,
    index: true
  },
  email: {
    type: 'string',
    required: true,
    // No unique constraint for bulk tests
    validator: (email: string) => email.includes('@')
  },
  age: {
    type: 'int',
    required: true,
    validator: (age: number) => age >= 0 && age <= 150,
    index: true
  },
  isActive: {
    type: 'boolean',
    default: true,
    index: true
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
    default: new Date('2023-01-01'),
    index: true
  }
}

// Schema for tests without unique constraints to avoid conflicts
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
    validator: (age: number) => age >= 0 && age <= 150,
    index: true
  },
  isActive: {
    type: 'boolean',
    default: true,
    index: true
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
    default: new Date('2023-01-01'),
    index: true
  }
}

// Schema for tests without unique constraints to avoid conflicts
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
    validator: (price: number) => price > 0,
    index: true
  },
  category: {
    type: 'string',
    required: true,
    index: true
  },
  inStock: {
    type: 'boolean',
    default: true,
    index: true
  },
  rating: {
    type: 'double',
    validator: (rating: number | undefined) => rating === undefined || (rating >= 0 && rating <= 5)
  }
}

describe('TypedCollection', () => {
  let userCollection: TypedCollection<User, typeof userSchema>
  let productCollection: TypedCollection<Product, TypedSchemaDefinition<Product>>
  let testDir: string

  beforeEach(async () => {
    testDir = createTestDir('typed-collection-main')

    // Create user collection with direct schema
    userCollection = createTypedCollection({
      name: 'test-users-main',
      root: testDir,
      schema: userSchema,
      list: new List<User>(),
      adapter: new AdapterMemory<User>(),
      schemaOptions: {
        strict: false,
        coerceTypes: true
      }
    })

    // Create product collection with complete schema
    productCollection = createTypedCollection({
      name: 'test-products-main',
      schema: productSchema,
      root: testDir,
      list: new List<Product>(),
      adapter: new AdapterMemory<Product>(),
      schemaOptions: { coerceTypes: true, validateRequired: true }
    })

    await userCollection.reset()
    await productCollection.reset()
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  describe('Schema Integration', () => {
    it('should automatically create indexes from schema', () => {
      const indexes = userCollection.listIndexes()
      expect(indexes.length).toBeGreaterThan(0)

      // Check that schema-defined indexes exist
      const indexNames = indexes.map(idx => idx.name)
      expect(indexNames).toContain('id')
      expect(indexNames).toContain('name')
      expect(indexNames).toContain('email')
      expect(indexNames).toContain('age')
    })

    it('should validate schema on document insertion', async () => {
      // Valid user
      const validUser = {
        id: 501,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        tags: ['developer', 'typescript'],
        profile: {
          bio: 'Software developer',
          settings: {
            notifications: true,
            theme: 'dark' as const
          }
        },
        createdAt: new Date()
      }

      const result = await userCollection.insert(validUser)
      expect(result).toBeDefined()
      expect(result?.id).toBe(501)
    })

    it('should reject invalid documents in strict mode', async () => {
      // Create a strict collection for this test
      const strictTestDir = createTestDir('typed-collection-strict')
      const strictProductCollection = createTypedCollection({
        name: 'strict-test-products',
        schema: productSchema,
        root: strictTestDir,
        list: new List<Product>(),
        adapter: new AdapterMemory<Product>(),
        schemaOptions: {
          strict: true,
          coerceTypes: false,
          validateRequired: true
        }
      })

      const invalidProduct = {
        id: 'prod1',
        name: 'Test Product',
        price: -10, // Invalid: negative price
        category: 'electronics',
        inStock: true
      }

      // Check that insert throws in strict mode
      await expect(strictProductCollection.insert(invalidProduct as any))
        .rejects.toThrow()
    })

    it('should coerce types when enabled', async () => {
      const userWithStringAge = {
        id: 2,
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: '25', // String instead of number
        isActive: 'true', // String instead of boolean
        tags: ['designer'],
        profile: {
          bio: 'UI/UX Designer',
          settings: {
            notifications: false,
            theme: 'light' as const
          }
        },
        createdAt: new Date()
      }

      const result = await userCollection.insert(userWithStringAge as any)
      expect(result).toBeDefined()
      expect(typeof result?.age).toBe('number')
      expect(result?.age).toBe(25)
    })
  })

  describe('Type-Safe Queries', () => {
    it('should support type-safe field queries', async () => {
      // Create separate collection for this test
      const queriesTestDir = createTestDir('typed-collection-queries-1')
      const queriesUserCollection = createTypedCollection({
        name: 'test-users-queries-1',
        root: queriesTestDir,
        schema: testUserSchema, // Use schema without unique constraints
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: {
          strict: false,
          coerceTypes: true
        }
      })

      // Insert test data
      const users = [
        {
          id: 3001,
          name: 'Alice',
          email: 'alice3@example.com',
          age: 25,
          isActive: true,
          tags: ['developer', 'react'],
          profile: {
            bio: 'Frontend developer',
            settings: { notifications: true, theme: 'light' as const }
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 3002,
          name: 'Bob',
          email: 'bob3@example.com',
          age: 30,
          isActive: false,
          tags: ['backend', 'node'],
          profile: {
            bio: 'Backend developer',
            settings: { notifications: false, theme: 'dark' as const }
          },
          createdAt: new Date('2023-02-01')
        },
        {
          id: 3003,
          name: 'Charlie',
          email: 'charlie3@example.com',
          age: 35,
          isActive: true,
          tags: ['fullstack', 'typescript'],
          profile: {
            bio: 'Full-stack developer',
            settings: { notifications: true, theme: 'dark' as const }
          },
          createdAt: new Date('2023-03-01')
        }
      ]

      for (const user of users) {
        await queriesUserCollection.insert(user)
      }

      // Type-safe queries with IntelliSense support
      const activeUsers = await queriesUserCollection.find({
        isActive: true
      })
      expect(activeUsers).toHaveLength(2)

      const youngUsers = await queriesUserCollection.find({
        age: { $lt: 30 }
      })
      expect(youngUsers).toHaveLength(1)
      expect(youngUsers[0].name).toBe('Alice')
    })

    it('should support complex type-safe queries', async () => {
      // Create separate collection for this test
      const queriesUserCollection = createTypedCollection({
        name: 'test-users-queries-2',
        root: './test-data-queries-2',
        schema: testUserSchema, // Use schema without unique constraints
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: {
          strict: false,
          coerceTypes: true
        }
      })

      // Insert test data
      const users = [
        {
          id: 3001,
          name: 'Alice',
          email: 'alice3@example.com',
          age: 25,
          isActive: true,
          tags: ['developer', 'react'],
          profile: {
            bio: 'Frontend developer',
            settings: { notifications: true, theme: 'light' as const }
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 3002,
          name: 'Bob',
          email: 'bob3@example.com',
          age: 30,
          isActive: false,
          tags: ['backend', 'node'],
          profile: {
            bio: 'Backend developer',
            settings: { notifications: false, theme: 'dark' as const }
          },
          createdAt: new Date('2023-02-01')
        },
        {
          id: 3003,
          name: 'Charlie',
          email: 'charlie3@example.com',
          age: 35,
          isActive: true,
          tags: ['fullstack', 'typescript'],
          profile: {
            bio: 'Full-stack developer',
            settings: { notifications: true, theme: 'dark' as const }
          },
          createdAt: new Date('2023-03-01')
        }
      ]

      for (const user of users) {
        await queriesUserCollection.insert(user)
      }

      const complexQuery = await queriesUserCollection.find({
        $and: [
          { age: { $gte: 25 } },
          { isActive: true },
          { 'profile.settings.theme': 'dark' }
        ]
      })
      expect(complexQuery).toHaveLength(1)
      expect(complexQuery[0].name).toBe('Charlie')
    })

    it('should support type-safe field-based queries', async () => {
      // Create separate collection for this test
      const queriesUserCollection = createTypedCollection({
        name: 'test-users-queries-3',
        root: './test-data-queries-3',
        schema: testUserSchema, // Use schema without unique constraints
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: {
          strict: false,
          coerceTypes: true
        }
      })

      // Insert test data
      const users = [
        {
          id: 3001,
          name: 'Alice',
          email: 'alice3@example.com',
          age: 25,
          isActive: true,
          tags: ['developer', 'react'],
          profile: {
            bio: 'Frontend developer',
            settings: { notifications: true, theme: 'light' as const }
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 3002,
          name: 'Bob',
          email: 'bob3@example.com',
          age: 30,
          isActive: false,
          tags: ['backend', 'node'],
          profile: {
            bio: 'Backend developer',
            settings: { notifications: false, theme: 'dark' as const }
          },
          createdAt: new Date('2023-02-01')
        },
        {
          id: 3003,
          name: 'Charlie',
          email: 'charlie3@example.com',
          age: 35,
          isActive: true,
          tags: ['fullstack', 'typescript'],
          profile: {
            bio: 'Full-stack developer',
            settings: { notifications: true, theme: 'dark' as const }
          },
          createdAt: new Date('2023-03-01')
        }
      ]

      for (const user of users) {
        await queriesUserCollection.insert(user)
      }

      // Verify data was inserted
      const allUsers = await queriesUserCollection.find({})
      expect(allUsers.length).toBeGreaterThan(0)

      const usersByAge = await queriesUserCollection.findBy('age', 30)
      expect(usersByAge.length).toBeGreaterThan(0)
      const bobUser = usersByAge.find(user => user.name === 'Bob')
      expect(bobUser).toBeDefined()
      expect(bobUser?.name).toBe('Bob')

      const firstActiveUser = await queriesUserCollection.findFirstBy('isActive', true)
      expect(firstActiveUser?.name).toBe('Alice')
    })

    it('should validate query operators against field types', async () => {
      // Create separate collection for this test
      const queriesUserCollection = createTypedCollection({
        name: 'test-users-queries-4',
        root: './test-data-queries-4',
        schema: testUserSchema, // Use schema without unique constraints
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: {
          strict: false,
          coerceTypes: true
        }
      })

      // This should work - string field with string operator
      const nameQuery = await queriesUserCollection.find({
        name: { $regex: 'Alice' }
      })
      expect(nameQuery).toHaveLength(0) // No data inserted for this test

      // Create a strict collection for validation testing
      const strictUserCollection = createTypedCollection({
        name: 'strict-users-validation',
        root: './test-data-validation',
        schema: userSchema,
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: {
          strict: true,
          coerceTypes: false
        }
      })

      // Query validation should catch type mismatches in strict mode
      const validation = strictUserCollection.validateQuery({
        age: { $regex: 'invalid' } // $regex not compatible with number
      })
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Type-Safe Updates', () => {
    beforeEach(async () => {
      // Clear collection before each test
      await userCollection.reset()

      await userCollection.insert({
        id: 100,
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
        isActive: true,
        tags: ['test'],
        profile: {
          bio: 'Test bio',
          settings: { notifications: true, theme: 'light' as const }
        },
        createdAt: new Date()
      })
    })

    it('should support type-safe updates', async () => {
      const user = await userCollection.findFirst({ id: 100 })
      const updated = await userCollection.update(
        { id: 100 },
        {
          age: 26,
          profile: {
            ...user!.profile,
            bio: 'Updated bio'
          },
          tags: ['test', 'updated']
        }
      )

      expect(updated).toHaveLength(1)
      expect(updated[0].age).toBe(26)
      expect(updated[0].profile.bio).toBe('Updated bio')
      expect(updated[0].tags).toContain('updated')
    })

    it('should support type-safe partial updates', async () => {
      const updated = await userCollection.updateFirst(
        { id: 100 },
        {
          isActive: false,
          age: 26
        }
      )

      expect(updated?.isActive).toBe(false)
      expect(updated?.age).toBe(26)
    })

    it('should support type-safe updates by ID', async () => {
      const updated = await userCollection.updateWithId(
        100,
        { name: 'Updated Name' }
      )

      expect(updated?.name).toBe('Updated Name')
    })
  })

  describe('Index Management', () => {
    it('should support creating additional indexes', async () => {
      await userCollection.createIndex('email_index', 'email', {
        unique: true,
        sparse: true
      })

      const indexes = userCollection.listIndexes()
      const emailIndex = indexes.find(idx => idx.name === 'email_index')
      expect(emailIndex).toBeDefined()
    })

    it('should support dropping indexes', () => {
      userCollection.dropIndex('age')

      const indexes = userCollection.listIndexes()
      const ageIndex = indexes.find(idx => idx.name === 'age')
      expect(ageIndex).toBeUndefined()
    })
  })

  describe('Schema Utilities', () => {
    it('should provide access to schema', () => {
      const schema = userCollection.getSchema()
      expect(schema.id).toBeDefined()
      expect(schema.name).toBeDefined()
      expect(schema.email).toBeDefined()
    })

    it('should validate documents against schema', () => {
      const validDoc = {
        id: 502,
        name: 'Test',
        email: 'test@example.com',
        age: 25,
        isActive: true,
        tags: [],
        profile: {
          bio: '',
          settings: { notifications: true, theme: 'light' as const }
        },
        createdAt: new Date()
      }

      const validation = userCollection.validateDocument(validDoc)
      expect(validation.valid).toBe(true)

      const invalidDoc = {
        id: 'invalid', // Should be number
        name: 123, // Should be string
        email: 'invalid-email', // Should contain @
        age: -5 // Should be positive
      }

      const invalidValidation = userCollection.validateDocument(invalidDoc)
      expect(invalidValidation.valid).toBe(false)
      expect(invalidValidation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Performance and Integration', () => {
    it('should maintain performance with schema validation', async () => {
      // Create separate collection for performance test
      const performanceUserCollection = createTypedCollection({
        name: 'test-users-performance',
        root: './test-data-performance',
        schema: testUserSchema, // Use schema without unique constraints
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: {
          strict: false,
          coerceTypes: true
        }
      })

      const startTime = performance.now()

      // Insert many records
      const users = Array.from({ length: 100 }, (_, i) => ({
        id: i + 401,
        name: `User ${i + 401}`,
        email: `user${i + 401}@example.com`,
        age: 20 + i,
        isActive: true,
        tags: [],
        profile: {
          bio: '',
          settings: { notifications: true, theme: 'light' as const }
        },
        createdAt: new Date()
      }))

      for (const user of users) {
        await performanceUserCollection.insert(user)
      }

      const endTime = performance.now()
      const duration = endTime - startTime
      console.log(`Inserted 100 records in ${duration}ms`)
    })
  })
})

describe('TypedCollection Type-safe Update Operations', () => {
  let userCollection: TypedCollection<User, typeof userSchema>
  let productCollection: TypedCollection<Product, TypedSchemaDefinition<Product>>

  beforeEach(async () => {
    userCollection = createTypedCollection({
      name: 'test-users-updates',
      schema: userSchema,
      root: './test-data-users',
      list: new List<User>(),
      adapter: new AdapterMemory<User>(),
      schemaOptions: { coerceTypes: true, validateRequired: true }
    })

    productCollection = createTypedCollection({
      name: 'test-products-updates',
      schema: productSchema,
      root: './test-data-products',
      list: new List<Product>(),
      adapter: new AdapterMemory<Product>(),
      schemaOptions: { coerceTypes: true, validateRequired: true }
    })

    // Insert test data
    await userCollection.insert({
      id: 301,
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
      id: 'prod-301',
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
  })

  describe('Atomic Update Operations', () => {
    it('should perform atomic update with $set operator', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
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

    it('should perform atomic update with $inc operator', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $inc: { age: 5 }
        }
      })

      expect(result.modifiedDocuments[0].age).toBe(35)
    })

    it('should perform atomic update with $mul operator', async () => {
      // Create separate product collection for this test
      const testProductCollection = createTypedCollection({
        name: 'test-products-mul',
        schema: testProductSchema,
        root: './test-data-mul',
        list: new List<Product>(),
        adapter: new AdapterMemory<Product>(),
        schemaOptions: { coerceTypes: true, validateRequired: true }
      })

      await testProductCollection.insert({
        id: 'prod-mul-1',
        name: 'Laptop',
        price: 999.99,
        category: 'electronics',
        inStock: true,
        rating: 4.5
      })

      const result = await testProductCollection.updateAtomic({
        filter: { id: 'prod-mul-1' },
        update: {
          $mul: { price: 0.9 } // 10% discount
        }
      })

      expect(result.modifiedDocuments[0].price).toBeCloseTo(899.99, 2)
    })

    it('should perform atomic update with $min and $max operators', async () => {
      // Current age is 30
      await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $min: { age: 25 }, // Should update since 25 < 30
        }
      })

      let user = await userCollection.findById(301)
      expect(user?.age).toBe(25) // Should be updated to 25

      await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $max: { age: 35 }  // Should update since 35 > 25
        }
      })

      user = await userCollection.findById(301)
      expect(user?.age).toBe(35) // Should be updated to 35
    })

    it('should perform atomic update with $currentDate operator', async () => {
      const beforeUpdate = new Date()

      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
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

    it('should perform atomic update with $unset operator', async () => {
      // Check initial state
      const initialProduct = await productCollection.findById('prod-301')
      console.log('Initial product:', initialProduct)

      const result = await productCollection.updateAtomic({
        filter: { id: 'prod-301' },
        update: {
          $unset: { rating: true }
        }
      })

      console.log('Modified product:', result.modifiedDocuments[0])
      console.log('Has rating property:', result.modifiedDocuments[0].hasOwnProperty('rating'))

      expect(result.modifiedDocuments[0].rating).toBeUndefined()
    })
  })

  describe('Array Update Operations', () => {
    it('should perform $addToSet operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
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
        filter: { id: 301 },
        update: {
          $addToSet: {
            tags: 'typescript' // Already exists
          }
        }
      })

      const user = await userCollection.findById(301)
      expect(user?.tags.filter(tag => tag === 'typescript')).toHaveLength(1)
    })

    it('should perform $addToSet with $each', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $addToSet: {
            tags: { $each: ['react', 'node.js', 'typescript'] } // typescript already exists
          }
        }
      })

      const tags = result.modifiedDocuments[0].tags
      expect(tags).toContain('react')
      expect(tags).toContain('node.js')
      expect(tags.filter(tag => tag === 'typescript')).toHaveLength(1) // No duplicate
    })

    it('should perform $push operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $push: {
            tags: 'python'
          }
        }
      })

      expect(result.modifiedDocuments[0].tags).toContain('python')
      expect(result.modifiedDocuments[0].tags).toHaveLength(3)
    })

    it('should perform $push with $each and options', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $push: {
            tags: {
              $each: ['react', 'vue', 'angular'],
              $position: 1, // Insert at position 1
              $slice: 4     // Keep only first 4 elements
            }
          }
        }
      })

      const tags = result.modifiedDocuments[0].tags
      expect(tags).toHaveLength(4)
      expect(tags[1]).toBe('react') // Inserted at position 1
    })

    it('should perform $pull operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $pull: {
            tags: 'typescript'
          }
        }
      })

      expect(result.modifiedDocuments[0].tags).not.toContain('typescript')
      expect(result.modifiedDocuments[0].tags).toHaveLength(1)
    })

    it('should perform $pullAll operation', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $pullAll: {
            tags: ['developer', 'typescript']
          }
        }
      })

      expect(result.modifiedDocuments[0].tags).toHaveLength(0)
    })

    it('should perform $pop operation', async () => {
      // Add more tags first
      await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $push: {
            tags: { $each: ['react', 'vue'] }
          }
        }
      })

      // Pop last element
      const result1 = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $pop: { tags: 1 }
        }
      })

      expect(result1.modifiedDocuments[0].tags).not.toContain('vue')

      // Pop first element
      const result2 = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $pop: { tags: -1 }
        }
      })

      expect(result2.modifiedDocuments[0].tags).not.toContain('developer')
    })
  })

  describe('Bulk Update Operations', () => {
    it('should perform ordered bulk updates', async () => {
      // Create fresh collection for this test
      const bulkUserCollection = createTypedCollection({
        name: 'bulk-test-users-1',
        schema: testUserSchema, // Use schema without unique constraints
        root: './test-data-bulk-1',
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: { coerceTypes: true, validateRequired: true }
      })

      await bulkUserCollection.insert({
        id: 601,
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

      await bulkUserCollection.insert({
        id: 602,
        name: 'Bob Smith',
        email: 'bob.smith@example.com',
        age: 25,
        isActive: false,
        tags: ['designer'],
        profile: {
          bio: 'UI Designer',
          settings: {
            notifications: false,
            theme: 'dark'
          }
        },
        createdAt: new Date('2023-02-01')
      })

      const results = await bulkUserCollection.updateBulk({
        operations: [
          {
            filter: { id: 601 },
            update: { $inc: { age: 1 } }
          },
          {
            filter: { id: 602 },
            update: { $set: { isActive: true } }
          }
        ],
        options: { ordered: true }
      })

      expect(results).toHaveLength(2)
      expect(results[0].modifiedCount).toBe(1)
      expect(results[1].modifiedCount).toBe(1)

      // Check the modified documents directly from results
      expect(results[0].modifiedDocuments[0].id).toBe(601)
      expect(results[0].modifiedDocuments[0].age).toBe(31) // 30 + 1
      expect(results[1].modifiedDocuments[0].id).toBe(602)
      expect(results[1].modifiedDocuments[0].isActive).toBe(true)
    })

    it('should perform parallel bulk updates', async () => {
      // Create fresh collection for this test
      const bulkUserCollection2 = createTypedCollection({
        name: 'bulk-test-users-2',
        schema: testUserSchema, // Use schema without unique constraints
        root: './test-data-bulk-2',
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: { coerceTypes: true, validateRequired: true }
      })

      await bulkUserCollection2.insert({
        id: 701,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        age: 30,
        isActive: false,
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

      await bulkUserCollection2.insert({
        id: 703,
        name: 'Charlie Brown',
        email: 'charlie.brown@example.com',
        age: 25,
        isActive: false,
        tags: ['designer'],
        profile: {
          bio: 'UI Designer',
          settings: {
            notifications: false,
            theme: 'dark'
          }
        },
        createdAt: new Date('2023-02-01')
      })

      const results = await bulkUserCollection2.updateBulk({
        operations: [
          {
            filter: { age: { $gte: 25 } },
            update: { $set: { isActive: true } },
            options: { multi: true }
          }
        ],
        options: { ordered: false }
      })

      expect(results[0].modifiedCount).toBe(2) // Both users should be updated
    })
  })

  describe('Upsert Operations', () => {
    it('should perform upsert when no documents match', async () => {
      // Create separate collection for this test
      const upsertUserCollection = createTypedCollection({
        name: 'test-users-upsert',
        schema: testUserSchema, // Use schema without unique constraints
        root: './test-data-upsert',
        list: new List<User>(),
        adapter: new AdapterMemory<User>(),
        schemaOptions: { coerceTypes: true, validateRequired: true }
      })

      const result = await upsertUserCollection.updateAtomic({
        filter: { id: 999 },
        update: {
          $set: {
            name: 'New User',
            email: 'new@example.com',
            age: 20,
            isActive: true,
            tags: [],
            profile: {
              bio: '',
              settings: {
                notifications: true,
                theme: 'light'
              }
            },
            createdAt: new Date()
          }
        },
        options: { upsert: true }
      })

      expect(result.matchedCount).toBe(0)
      expect(result.upsertedCount).toBe(1)
      expect(result.upsertedIds).toHaveLength(1)

      const newUser = await upsertUserCollection.findById(999)
      expect(newUser?.name).toBe('New User')
    })
  })

  describe('Schema Validation in Updates', () => {
    it('should validate schema during updates', async () => {
      await expect(
        userCollection.updateAtomic({
          filter: { id: 301 },
          update: {
            $set: {
              age: 'invalid' as any // Should fail validation
            }
          },
          options: { validateSchema: true }
        })
      ).rejects.toThrow('Schema validation failed')
    })

    it('should skip validation when disabled', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
        update: {
          $set: {
            age: 'invalid' as any
          }
        },
        options: { validateSchema: false }
      })

      expect(result.modifiedCount).toBe(1)
    })
  })

  describe('Mixed Update Operations', () => {
    it('should handle mixed direct and operator updates', async () => {
      const result = await userCollection.updateAtomic({
        filter: { id: 301 },
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
    './test-data-queries-2',
    './test-data-queries-3',
    './test-data-queries-4',
    './test-data-validation',
    './test-data-performance',
    './test-data-users',
    './test-data-products',
    './test-data-mul',
    './test-data-bulk-1',
    './test-data-bulk-2',
    './test-data-upsert'
  ])
})
