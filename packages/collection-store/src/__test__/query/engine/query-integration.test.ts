import { describe, test, expect } from 'bun:test'
import { query } from '../../../query/query'

// Test data
const testData = [
  { id: 1, name: 'Alice', age: 25, status: 'active', tags: ['developer', 'frontend'], score: 85.5 },
  { id: 2, name: 'Bob', age: 30, status: 'inactive', tags: ['developer', 'backend'], score: 92.0 },
  { id: 3, name: 'Charlie', age: 35, status: 'active', tags: ['manager', 'team-lead'], score: 78.3 },
  { id: 4, name: 'Diana', age: 28, status: 'active', tags: ['designer', 'ui-ux'], score: 88.7 },
  { id: 5, name: 'Eve', age: 22, status: 'pending', tags: ['intern', 'frontend'], score: 65.2 },
  { id: 6, name: 'Frank', age: 40, status: 'active', tags: ['architect', 'backend'], score: 95.1 },
  { id: 7, name: 'Grace', age: 33, status: 'inactive', tags: ['qa', 'automation'], score: 82.4 }
]

describe('Query Integration Tests', () => {
  describe('Basic Field Equality', () => {
    test('should find users by exact name match', () => {
      const condition = query({ name: 'Alice' })
      const results = testData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Alice')
      expect(results[0].id).toBe(1)
    })

    test('should find users by status', () => {
      const condition = query({ status: 'active' })
      const results = testData.filter(condition)

      expect(results).toHaveLength(4)
      expect(results.every(user => user.status === 'active')).toBe(true)
    })

    test('should find users by numeric id', () => {
      const condition = query({ id: 3 })
      const results = testData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Charlie')
    })
  })

  describe('Comparison Operators', () => {
    test('should find users older than 30 using $gt', () => {
      const condition = query({ age: { $gt: 30 } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(3)
      expect(results.every(user => user.age > 30)).toBe(true)
      expect(results.map(u => u.name).sort()).toEqual(['Charlie', 'Frank', 'Grace'])
    })

    test('should find users with age >= 30 using $gte', () => {
      const condition = query({ age: { $gte: 30 } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(4)
      expect(results.every(user => user.age >= 30)).toBe(true)
    })

    test('should find users younger than 30 using $lt', () => {
      const condition = query({ age: { $lt: 30 } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(3)
      expect(results.every(user => user.age < 30)).toBe(true)
      expect(results.map(u => u.name).sort()).toEqual(['Alice', 'Diana', 'Eve'])
    })

    test('should find users with score <= 85 using $lte', () => {
      const condition = query({ score: { $lte: 85 } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(3)
      expect(results.every(user => user.score <= 85)).toBe(true)
    })

    test('should find users not named Alice using $ne', () => {
      const condition = query({ name: { $ne: 'Alice' } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(6)
      expect(results.every(user => user.name !== 'Alice')).toBe(true)
    })
  })

  describe('Array Operators', () => {
    test('should find users with specific status using $in', () => {
      const condition = query({ status: { $in: ['active', 'pending'] } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(5)
      expect(results.every(user => ['active', 'pending'].includes(user.status))).toBe(true)
    })

    test('should find users without specific status using $nin', () => {
      const condition = query({ status: { $nin: ['inactive'] } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(5)
      expect(results.every(user => user.status !== 'inactive')).toBe(true)
    })

    test('should find users with all specified tags using $all', () => {
      const condition = query({ tags: { $all: ['developer'] } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.every(user => user.tags.includes('developer'))).toBe(true)
      expect(results.map(u => u.name).sort()).toEqual(['Alice', 'Bob'])
    })

    test('should find users with arrays of specific size using $size', () => {
      const condition = query({ tags: { $size: 2 } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(7) // All users have exactly 2 tags
      expect(results.every(user => user.tags.length === 2)).toBe(true)
    })
  })

  describe('Logical Operators', () => {
    test('should find active developers using $and', () => {
      const condition = query({
        $and: [
          { status: 'active' },
          { tags: { $in: ['developer'] } }
        ]
      })
      const results = testData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Alice')
      expect(results[0].status).toBe('active')
      expect(results[0].tags).toContain('developer')
    })

    test('should find users who are either young or have high score using $or', () => {
      const condition = query({
        $or: [
          { age: { $lt: 25 } },
          { score: { $gt: 90 } }
        ]
      })
      const results = testData.filter(condition)

      expect(results).toHaveLength(3)
      expect(results.map(u => u.name).sort()).toEqual(['Bob', 'Eve', 'Frank'])
    })

    test('should find users who are NOT inactive using $not', () => {
      const condition = query({
        $not: { status: 'inactive' }
      })
      const results = testData.filter(condition)

      expect(results).toHaveLength(5)
      expect(results.every(user => user.status !== 'inactive')).toBe(true)
    })

    test('should find users who are neither young nor have low score using $nor', () => {
      const condition = query({
        $nor: [
          { age: { $lt: 25 } },
          { score: { $lt: 70 } }
        ]
      })
      const results = testData.filter(condition)

      expect(results).toHaveLength(6)
      expect(results.every(user => user.age >= 25 && user.score >= 70)).toBe(true)
    })
  })

  describe('Element Operators', () => {
    test('should find users where age field exists using $exists', () => {
      const condition = query({ age: { $exists: true } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(7) // All users have age field
    })

    test('should find users where non-existent field does not exist using $exists', () => {
      const condition = query({ nonExistentField: { $exists: false } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(7) // All users don't have this field
    })

    test('should find users by field type using $type', () => {
      const condition = query({ name: { $type: 'string' } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(7) // All names are strings
    })

    test('should find numeric fields using $type', () => {
      const condition = query({ age: { $type: 'number' } })
      const results = testData.filter(condition)

      expect(results).toHaveLength(7) // All ages are numbers
    })
  })

  describe('Complex Queries', () => {
    test('should handle complex nested query with multiple operators', () => {
      const condition = query({
        $and: [
          { status: 'active' },
          {
            $or: [
              { age: { $gte: 30 } },
              { score: { $gt: 85 } }
            ]
          },
          { tags: { $nin: ['intern'] } }
        ]
      })
      const results = testData.filter(condition)

      expect(results).toHaveLength(4)
      expect(results.map(u => u.name).sort()).toEqual(['Alice', 'Charlie', 'Diana', 'Frank'])
    })

    test('should handle query with implicit AND (multiple fields)', () => {
      const condition = query({
        status: 'active',
        age: { $gte: 30 }
      })
      const results = testData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Charlie', 'Frank'])
    })

    test('should handle empty query (matches all)', () => {
      const condition = query({})
      const results = testData.filter(condition)

      expect(results).toHaveLength(7) // Matches all users
    })
  })

  describe('Edge Cases', () => {
    test('should handle query that matches no documents', () => {
      const condition = query({ name: 'NonExistentUser' })
      const results = testData.filter(condition)

      expect(results).toHaveLength(0)
    })

    test('should handle query with null values', () => {
      const dataWithNull = [
        ...testData,
        { id: 8, name: null, age: 25, status: 'active', tags: [], score: 0 }
      ]

      const condition = query({ name: null as any })
      const results = dataWithNull.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(8)
    })

    test('should handle query with undefined values', () => {
      const dataWithUndefined = [
        ...testData,
        { id: 9, age: 25, status: 'active', tags: [], score: 0 } // name is undefined
      ]

      const condition = query({ name: { $exists: false } })
      const results = dataWithUndefined.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(9)
    })
  })

  describe('Performance and Functionality', () => {
    test('should work with large dataset efficiently', () => {
      // Generate larger dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User${i + 1}`,
        age: 20 + (i % 50),
        status: ['active', 'inactive', 'pending'][i % 3],
        tags: [`tag${i % 10}`, `category${i % 5}`],
        score: Math.random() * 100
      }))

      const condition = query({
        $and: [
          { status: 'active' },
          { age: { $gte: 30, $lt: 40 } }
        ]
      })

      const start = Date.now()
      const results = largeData.filter(condition)
      const duration = Date.now() - start

      expect(results.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(100) // Should complete in less than 100ms
      expect(results.every(user =>
        user.status === 'active' && user.age >= 30 && user.age < 40
      )).toBe(true)
    })

    test('should be reusable across different datasets', () => {
      const condition = query({ status: 'active' })

      const dataset1 = testData.slice(0, 3)
      const dataset2 = testData.slice(3, 7)

      const results1 = dataset1.filter(condition)
      const results2 = dataset2.filter(condition)

      expect(results1.every(user => user.status === 'active')).toBe(true)
      expect(results2.every(user => user.status === 'active')).toBe(true)
    })
  })
})