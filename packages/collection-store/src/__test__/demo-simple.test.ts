import 'jest'
import fs from 'fs-extra'
import path from 'path'
import Collection from '../collection'
import { Person } from '../demo/Person'
import { collection_config as fileStorageConfig } from '../demo/collection_2'
import { collection_config as listStorageConfig } from '../demo/collection_4'
import { create } from '../demo/create'

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, 'demo-simple-test-data')

beforeAll(async () => {
  // Clean up test data before all tests
  try {
    await fs.remove(TEST_DATA_DIR)
  } catch (e) {
    // Directory might not exist
  }
  await fs.ensureDir(TEST_DATA_DIR)
})

afterAll(async () => {
  // Clean up test data after all tests
  try {
    await fs.remove(TEST_DATA_DIR)
  } catch (e) {
    // Directory might not exist
  }
})

describe('Demo Person Collection - Simple Tests', () => {
  describe('Person Type Validation', () => {
    it('should validate Person type structure', () => {
      const person: Person = {
        id: 1,
        name: 'John Doe',
        age: 30,
        ssn: '123-45-6789',
        address: {
          appart: '2A',
          home: '123 Main St',
          city: 'New York'
        },
        page: 'http://example.com'
      }

      expect(person.id).toBe(1)
      expect(person.name).toBe('John Doe')
      expect(person.age).toBe(30)
      expect(person.ssn).toBe('123-45-6789')
      expect(person.address.city).toBe('New York')
      expect(person.page).toBe('http://example.com')
    })

    it('should handle optional apartment field', () => {
      const personWithoutApart: Person = {
        name: 'Jane Doe',
        age: 25,
        ssn: '987-65-4321',
        address: {
          home: '456 Oak St',
          city: 'Los Angeles'
        },
        page: 'http://example.com'
      }

      expect(personWithoutApart.address.appart).toBeUndefined()
      expect(personWithoutApart.address.home).toBe('456 Oak St')
    })

    it('should handle apartment as object', () => {
      const personWithApartObject: Person = {
        name: 'Bob Smith',
        age: 35,
        ssn: '555-55-5555',
        address: {
          appart: {
            stage: '2nd floor',
            place: 'left wing'
          },
          home: '789 Pine St',
          city: 'Chicago'
        },
        page: 'http://example.com'
      }

      expect(typeof personWithApartObject.address.appart).toBe('object')
      expect((personWithApartObject.address.appart as any).stage).toBe('2nd floor')
    })
  })

  describe('Demo Data Creation', () => {
    it('should create collection with demo data using create function', async () => {
      const config = {
        ...fileStorageConfig,
        root: path.join(TEST_DATA_DIR, 'demo-file-storage'),
        name: 'DemoPersonFile'
      }

      const collection = await create(config)

      // Verify collection has demo data
      expect(collection.list.length).toBe(8)

      // Test specific records exist
      const alex = await collection.findFirstBy('name', 'alex')
      expect(alex).toBeDefined()
      expect(alex?.age).toBe(42)
      expect(alex?.ssn).toBe('000-0000-000001')

      const monika = await collection.findFirstBy('id', 7)
      expect(monika).toBeDefined()
      expect(monika?.name).toBe('monika')
      expect(monika?.address.city).toBe('Los Angeles')
    })

    it('should create collection with list storage and demo data', async () => {
      const config = {
        ...listStorageConfig,
        root: path.join(TEST_DATA_DIR, 'demo-list-storage'),
        name: 'DemoPersonList'
      }

      const collection = await create(config)

      // Verify collection has demo data
      expect(collection.list.length).toBeGreaterThanOrEqual(8)

      // Test that all SSNs are unique
      const ssns = new Set()
      for await (const person of collection.list.forward) {
        expect(ssns.has(person.ssn)).toBe(false)
        ssns.add(person.ssn)
      }
      expect(ssns.size).toBe(8)
    })
  })

  describe('Basic Collection Operations', () => {
    it('should create empty collection and add records', async () => {
      const config = {
        ...listStorageConfig,
        root: path.join(TEST_DATA_DIR, 'empty-collection'),
        name: 'EmptyPerson'
      }

      const collection = Collection.create<Person>(config)

      // Note: Collection might auto-load existing data, so we'll clear it first
      await collection.list.reset()
      expect(collection.list.length).toBe(0)

      // Add a person
      const newPerson: Person = {
        name: 'Test Person',
        age: 25,
        ssn: '111-11-1111',
        address: {
          home: '123 Test St',
          city: 'Test City'
        },
        page: 'http://test.com'
      }

      await collection.push(newPerson)
      expect(collection.list.length).toBe(1)

      // Find the added person
      const found = await collection.findFirstBy('name', 'Test Person')
      expect(found).toBeDefined()
      expect(found?.age).toBe(25)
      expect(found?.ssn).toBe('111-11-1111')
    })

    it('should handle queries on demo data', async () => {
      const config = {
        ...fileStorageConfig,
        root: path.join(TEST_DATA_DIR, 'query-test'),
        name: 'QueryPerson'
      }

      const collection = await create(config)

      // Test simple find by name
      const jameResults = await collection.findBy('name', 'jame')
      expect(jameResults.length).toBe(1)
      expect(jameResults[0]?.id).toBe(1)

      // Test find by age
      const age30Results = await collection.find({ age: 30 })
      expect(age30Results.length).toBeGreaterThan(0)

      // Test $in operator
      const ageInResults = await collection.find({ age: { $in: [30, 29] } })
      expect(ageInResults.length).toBeGreaterThan(0)
    })

    it('should handle unique constraints', async () => {
      const config = {
        ...fileStorageConfig,
        root: path.join(TEST_DATA_DIR, 'unique-test'),
        name: 'UniquePerson'
      }

      const collection = await create(config)

      // Try to add person with duplicate SSN
      const duplicatePerson: Person = {
        name: 'Duplicate',
        age: 25,
        ssn: '000-0000-000001', // Same as alex in demo data
        address: {
          home: '999 Test St',
          city: 'Test City'
        },
        page: 'http://test.com'
      }

      await expect(collection.push(duplicatePerson)).rejects.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle person without apartment', async () => {
      const config = {
        ...listStorageConfig,
        root: path.join(TEST_DATA_DIR, 'no-apartment'),
        name: 'NoApartmentPerson'
      }

      const collection = Collection.create<Person>(config)

      const personWithoutApart: Person = {
        name: 'No Apartment',
        age: 30,
        ssn: '222-22-2222',
        address: {
          home: '456 No Apt St',
          city: 'No Apt City'
        },
        page: 'http://noapt.com'
      }

      await collection.push(personWithoutApart)

      const found = await collection.findFirstBy('name', 'No Apartment')
      expect(found).toBeDefined()
      expect(found?.address.appart).toBeUndefined()
      expect(found?.address.home).toBe('456 No Apt St')
    })

    it('should handle queries on empty results', async () => {
      const config = {
        ...listStorageConfig,
        root: path.join(TEST_DATA_DIR, 'empty-query'),
        name: 'EmptyQueryPerson'
      }

      const collection = Collection.create<Person>(config)

      // Add one person
      await collection.push({
        name: 'Only Person',
        age: 25,
        ssn: '333-33-3333',
        address: {
          home: '789 Only St',
          city: 'Only City'
        },
        page: 'http://only.com'
      })

      // Query for non-existent data
      const results = await collection.find({ age: 999 })
      expect(results.length).toBe(0)

      const nameResults = await collection.findBy('name', 'Non Existent')
      expect(nameResults.length).toBe(0)
    })
  })
})