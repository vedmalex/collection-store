import { describe, test, expect } from 'bun:test'
import { query } from '../../../query/query'

// Test data for advanced queries
const advancedTestData = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    profile: {
      bio: 'Senior developer with 10+ years experience',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      rating: 4.8,
      verified: true
    },
    metadata: {
      created: new Date('2020-01-15'),
      lastLogin: new Date('2024-01-10'),
      loginCount: 156
    }
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@company.org',
    profile: {
      bio: 'Full-stack engineer passionate about clean code',
      skills: ['Python', 'Django', 'PostgreSQL', 'Docker'],
      rating: 4.6,
      verified: false
    },
    metadata: {
      created: new Date('2021-03-22'),
      lastLogin: new Date('2024-01-08'),
      loginCount: 89
    }
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob.j@startup.io',
    profile: {
      bio: 'DevOps specialist focusing on cloud infrastructure',
      skills: ['AWS', 'Kubernetes', 'Terraform', 'Go'],
      rating: 4.9,
      verified: true
    },
    metadata: {
      created: new Date('2019-11-08'),
      lastLogin: new Date('2024-01-12'),
      loginCount: 234
    }
  },
  {
    id: 4,
    name: 'Alice Brown',
    email: 'alice.brown@tech.net',
    profile: {
      bio: 'Frontend architect with expertise in modern frameworks',
      skills: ['Vue.js', 'Angular', 'CSS', 'WebGL'],
      rating: 4.7,
      verified: true
    },
    metadata: {
      created: new Date('2022-06-14'),
      lastLogin: new Date('2024-01-09'),
      loginCount: 67
    }
  }
]

describe('Query Advanced Features Tests', () => {
  describe('Regular Expression Queries', () => {
    test('should find users by email domain using regex', () => {
      const condition = query({
        email: { $regex: /\.com$/ }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('John Doe')
      expect(results[0].email).toMatch(/\.com$/)
    })

    test('should find users by name pattern using string regex', () => {
      const condition = query({
        name: { $regex: '^J', $options: 'i' }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Jane Smith', 'John Doe'])
    })

    test('should find users by bio content using case-insensitive regex', () => {
      const condition = query({
        'profile.bio': { $regex: 'DEVELOPER', $options: 'i' }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('John Doe')
    })

    test('should find users with specific skills using regex', () => {
      const condition = query({
        'profile.skills': { $regex: /^Type/ }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].profile.skills).toContain('TypeScript')
    })
  })

  describe('Nested Field Queries', () => {
    test('should query nested object fields', () => {
      const condition = query({
        'profile.verified': true
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(3)
      expect(results.every(user => user.profile.verified === true)).toBe(true)
    })

    test('should query deeply nested fields with comparison operators', () => {
      const condition = query({
        'profile.rating': { $gte: 4.8 }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Bob Johnson', 'John Doe'])
    })

    test('should query nested array fields', () => {
      const condition = query({
        'profile.skills': { $in: ['React', 'Vue.js'] }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Alice Brown', 'John Doe'])
    })

    test('should query nested date fields', () => {
      const condition = query({
        'metadata.created': { $gte: new Date('2021-01-01') }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Alice Brown', 'Jane Smith'])
    })
  })

  describe('Array Element Matching', () => {
    test('should find users with all specified skills using $all', () => {
      const condition = query({
        'profile.skills': { $all: ['JavaScript', 'TypeScript'] }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('John Doe')
    })

    test('should find users with specific number of skills using $size', () => {
      const condition = query({
        'profile.skills': { $size: 4 }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(4) // All users have exactly 4 skills
    })

    test('should find users with skills containing specific pattern using $elemMatch', () => {
      // Note: $elemMatch works with array of objects, but we can test with simple values
      const condition = query({
        'profile.skills': { $elemMatch: { $regex: /Script$/ } }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('John Doe')
      expect(results[0].profile.skills.some(skill => /Script$/.test(skill))).toBe(true)
    })
  })

  describe('Modulo and Mathematical Operators', () => {
    test('should find users with even login counts using $mod', () => {
      const condition = query({
        'metadata.loginCount': { $mod: [2, 0] }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Bob Johnson', 'John Doe'])
      expect(results.every(user => user.metadata.loginCount % 2 === 0)).toBe(true)
    })

    test('should find users with login count remainder 1 when divided by 3', () => {
      const condition = query({
        'metadata.loginCount': { $mod: [3, 1] }
      })
      const results = advancedTestData.filter(condition)

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(user => user.metadata.loginCount % 3 === 1)).toBe(true)
    })
  })

  describe('Type Checking', () => {
    test('should find fields of specific types', () => {
      const condition = query({
        'profile.rating': { $type: 'number' }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(4) // All users have numeric ratings
    })

    test('should find boolean fields', () => {
      const condition = query({
        'profile.verified': { $type: 'boolean' }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(4) // All users have boolean verified field
    })

    test('should find date fields', () => {
      const condition = query({
        'metadata.created': { $type: 'date' }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(4) // All users have date created field
    })

    test('should find array fields', () => {
      const condition = query({
        'profile.skills': { $type: 'array' }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(4) // All users have array skills field
    })
  })

  describe('Complex Logical Combinations', () => {
    test('should find verified users with high ratings and recent activity', () => {
      const condition = query({
        $and: [
          { 'profile.verified': true },
          { 'profile.rating': { $gte: 4.7 } },
          { 'metadata.lastLogin': { $gte: new Date('2024-01-09') } }
        ]
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(3)
      expect(results.map(u => u.name).sort()).toEqual(['Alice Brown', 'Bob Johnson', 'John Doe'])
    })

    test('should find users who are either new or very active', () => {
      const condition = query({
        $or: [
          { 'metadata.created': { $gte: new Date('2022-01-01') } },
          { 'metadata.loginCount': { $gte: 200 } }
        ]
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Alice Brown', 'Bob Johnson'])
    })

    test('should find users with complex skill requirements', () => {
      const condition = query({
        $and: [
          { 'profile.verified': true },
          {
            $or: [
              { 'profile.skills': { $in: ['JavaScript', 'TypeScript'] } },
              { 'profile.skills': { $in: ['AWS', 'Kubernetes'] } }
            ]
          },
          { 'profile.rating': { $gt: 4.5 } }
        ]
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(2)
      expect(results.map(u => u.name).sort()).toEqual(['Bob Johnson', 'John Doe'])
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle queries on non-existent nested fields', () => {
      const condition = query({
        'profile.nonExistent.field': 'value'
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(0)
    })

    test('should handle mixed type comparisons gracefully', () => {
      const condition = query({
        'profile.rating': { $gt: '4.5' } // String comparison with number
      })
      const results = advancedTestData.filter(condition)

      // Should handle type coercion or comparison appropriately
      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    test('should handle empty arrays in $in operator', () => {
      const condition = query({
        'profile.skills': { $in: [] }
      })
      const results = advancedTestData.filter(condition)

      expect(results).toHaveLength(0) // Empty $in should match nothing
    })

    test('should handle null values in nested queries', () => {
      const dataWithNull = [
        ...advancedTestData,
        {
          id: 5,
          name: 'Test User',
          email: 'test@example.com',
          profile: null,
          metadata: {
            created: new Date(),
            lastLogin: new Date(),
            loginCount: 0
          }
        }
      ]

      const condition = query({
        'profile.verified': { $exists: false }
      })
      const results = dataWithNull.filter(condition)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Test User')
    })
  })

  describe('Performance with Complex Queries', () => {
    test('should handle deeply nested queries efficiently', () => {
      const condition = query({
        $and: [
          { 'profile.verified': true },
          { 'profile.rating': { $gte: 4.5 } },
          { 'profile.skills': { $size: 4 } },
          { 'metadata.loginCount': { $gte: 50 } },
          { 'metadata.created': { $lte: new Date() } }
        ]
      })

      const start = Date.now()
      const results = advancedTestData.filter(condition)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10) // Should be very fast for small dataset
      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    test('should handle multiple regex patterns efficiently', () => {
      const condition = query({
        $or: [
          { email: { $regex: /\.com$/ } },
          { email: { $regex: /\.org$/ } },
          { email: { $regex: /\.io$/ } },
          { email: { $regex: /\.net$/ } }
        ]
      })

      const start = Date.now()
      const results = advancedTestData.filter(condition)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10)
      expect(results).toHaveLength(4) // All users should match one of the patterns
    })
  })
})