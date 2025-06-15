import { describe, test, expect } from 'bun:test'
import { query } from '../query'
import { compileQuery } from '../compile_query'

// Extended test data covering various data types and edge cases
const testData = [
  {
    id: 1,
    name: 'Alice',
    age: 25,
    status: 'active',
    tags: ['developer', 'frontend'],
    score: 85.5,
    profile: { bio: 'Senior DEVELOPER', email: 'alice@test.com' },
    items: ['item1', 'item2'],
    values: [10, 20, 30],
    flags: 5, // Binary: 101
    counter: null,
    active: true,
    metadata: { created: new Date('2024-01-01'), version: 1 }
  },
  {
    id: 2,
    name: 'Bob',
    age: 30,
    status: 'inactive',
    tags: ['developer', 'backend'],
    score: 92.0,
    profile: { bio: 'Backend specialist', email: 'bob@example.org' },
    items: ['item3'],
    values: [40, 50],
    flags: 3, // Binary: 011
    counter: 42,
    active: false,
    metadata: { created: new Date('2024-02-01'), version: 2 }
  },
  {
    id: 3,
    name: 'Charlie',
    age: 35,
    status: 'active',
    tags: ['manager', 'team-lead'],
    score: 78.3,
    profile: { bio: 'Team manager', email: 'charlie@test.com' },
    items: [],
    values: [60],
    flags: 7, // Binary: 111
    counter: undefined,
    active: true,
    metadata: { created: new Date('2024-03-01'), version: 1 }
  },
  {
    id: 4,
    name: 'Diana',
    age: 28,
    status: 'active',
    tags: ['designer', 'ui-ux'],
    score: 88.7,
    profile: { bio: 'UX Designer', email: 'diana@example.org' },
    items: ['item1', 'item4', 'item5'],
    values: [15, 25, 35, 45],
    flags: 2, // Binary: 010
    counter: 0,
    active: true,
    metadata: { created: new Date('2024-04-01'), version: 3 }
  }
]

/**
 * Helper function to compare results between query and compileQuery
 */
function compareQueryResults(queryObj: any, testDescription: string) {
  // Get results using regular query
  const regularCondition = query(queryObj)
  const regularResults = testData.filter(regularCondition)

  // Get results using compiled query
  const compiled = compileQuery(queryObj)
  expect(compiled.error).toBeUndefined()
  const compiledResults = testData.filter(compiled.func)

  // Compare results
  expect(compiledResults).toEqual(regularResults)

  // Also test individual records for detailed comparison
  testData.forEach((record, index) => {
    const regularMatch = regularCondition(record)
    const compiledMatch = compiled.func(record)
    expect(compiledMatch).toBe(regularMatch)
  })
}

describe('Compile Query Compatibility Tests', () => {
  describe('Basic Field Equality', () => {
    test('should match simple string equality', () => {
      compareQueryResults({ name: 'Alice' }, 'string equality')
    })

    test('should match numeric equality', () => {
      compareQueryResults({ age: 30 }, 'numeric equality')
    })

    test('should match boolean equality', () => {
      compareQueryResults({ active: true }, 'boolean equality')
    })

    test('should match null equality', () => {
      compareQueryResults({ counter: null }, 'null equality')
    })

    test('should match nested field equality', () => {
      compareQueryResults({ 'profile.email': 'alice@test.com' }, 'nested field equality')
    })

    test('should match multiple fields (implicit $and)', () => {
      compareQueryResults({ status: 'active', age: 25 }, 'multiple fields')
    })
  })

  describe('Comparison Operators', () => {
    test('should match $eq operator', () => {
      compareQueryResults({ age: { $eq: 30 } }, '$eq operator')
    })

    test('should match $gt operator', () => {
      compareQueryResults({ age: { $gt: 30 } }, '$gt operator')
    })

    test('should match $gte operator', () => {
      compareQueryResults({ score: { $gte: 85 } }, '$gte operator')
    })

    test('should match $lt operator', () => {
      compareQueryResults({ age: { $lt: 30 } }, '$lt operator')
    })

    test('should match $lte operator', () => {
      compareQueryResults({ score: { $lte: 85 } }, '$lte operator')
    })

    test('should match $ne operator', () => {
      compareQueryResults({ status: { $ne: 'inactive' } }, '$ne operator')
    })

    test('should match $in operator with simple values', () => {
      compareQueryResults({ status: { $in: ['active', 'pending'] } }, '$in operator')
    })

    test('should match $in operator with array field', () => {
      compareQueryResults({ tags: { $in: ['developer', 'designer'] } }, '$in with array field')
    })

    test('should match $nin operator', () => {
      compareQueryResults({ status: { $nin: ['inactive'] } }, '$nin operator')
    })

    test('should match $nin operator with array field', () => {
      compareQueryResults({ tags: { $nin: ['intern'] } }, '$nin with array field')
    })
  })

  describe('Logical Operators', () => {
    test('should match $and operator', () => {
      compareQueryResults({
        $and: [
          { status: 'active' },
          { age: { $gt: 25 } }
        ]
      }, '$and operator')
    })

    test('should match $or operator', () => {
      compareQueryResults({
        $or: [
          { age: { $lt: 26 } },
          { score: { $gt: 90 } }
        ]
      }, '$or operator')
    })

    test('should match $not operator', () => {
      compareQueryResults({
        $not: { status: 'inactive' }
      }, '$not operator')
    })

    test('should match $not with complex condition', () => {
      compareQueryResults({
        $not: { age: { $gt: 30 } }
      }, '$not with complex condition')
    })

    test('should match $nor operator', () => {
      compareQueryResults({
        $nor: [
          { age: { $lt: 25 } },
          { score: { $lt: 80 } }
        ]
      }, '$nor operator')
    })

    test('should match complex nested logical operators', () => {
      compareQueryResults({
        $and: [
          { status: 'active' },
          {
            $or: [
              { age: { $gte: 30 } },
              { score: { $gt: 85 } }
            ]
          }
        ]
      }, 'complex nested logical operators')
    })
  })

  describe('Element Operators', () => {
    test('should match $exists true', () => {
      compareQueryResults({ counter: { $exists: true } }, '$exists true')
    })

    test('should match $exists false', () => {
      compareQueryResults({ nonExistentField: { $exists: false } }, '$exists false')
    })

    test('should match $type string', () => {
      compareQueryResults({ name: { $type: 'string' } }, '$type string')
    })

    test('should match $type number', () => {
      compareQueryResults({ age: { $type: 'number' } }, '$type number')
    })

    test('should match $type boolean', () => {
      compareQueryResults({ active: { $type: 'boolean' } }, '$type boolean')
    })

    test('should match $type array', () => {
      compareQueryResults({ tags: { $type: 'array' } }, '$type array')
    })

    test('should match $type object', () => {
      compareQueryResults({ profile: { $type: 'object' } }, '$type object')
    })

    test('should match $type null', () => {
      compareQueryResults({ counter: { $type: 'null' } }, '$type null')
    })

    test('should match $type with multiple types', () => {
      compareQueryResults({ counter: { $type: ['number', 'null'] } }, '$type multiple')
    })
  })

  describe('Array Operators', () => {
    test('should match $all operator', () => {
      compareQueryResults({ tags: { $all: ['developer'] } }, '$all operator')
    })

    test('should match $all with multiple elements', () => {
      compareQueryResults({ tags: { $all: ['developer', 'frontend'] } }, '$all multiple elements')
    })

    test('should match $all with empty array', () => {
      compareQueryResults({ tags: { $all: [] } }, '$all empty array')
    })

    test('should match $size operator', () => {
      compareQueryResults({ tags: { $size: 2 } }, '$size operator')
    })

    test('should match $size with different sizes', () => {
      compareQueryResults({ items: { $size: 0 } }, '$size zero')
      compareQueryResults({ items: { $size: 1 } }, '$size one')
      compareQueryResults({ items: { $size: 3 } }, '$size three')
    })

    test('should match $elemMatch operator', () => {
      // Add test data with nested objects in arrays
      const extendedTestData = [
        ...testData,
        {
          id: 5,
          name: 'Eve',
          scores: [{ subject: 'math', value: 95 }, { subject: 'english', value: 87 }],
          items: [{ name: 'item1', count: 5 }, { name: 'item2', count: 10 }]
        }
      ]

      const queryObj = { scores: { $elemMatch: { value: { $gt: 90 } } } }

      // Test with extended data
      const regularCondition = query(queryObj)
      const regularResults = extendedTestData.filter(regularCondition)

      const compiled = compileQuery(queryObj)
      expect(compiled.error).toBeUndefined()
      const compiledResults = extendedTestData.filter(compiled.func)

      expect(compiledResults).toEqual(regularResults)
    })
  })

  describe('Evaluation Operators', () => {
    test('should match $mod operator', () => {
      compareQueryResults({ age: { $mod: [5, 0] } }, '$mod operator')
    })

    test('should match $mod with different values', () => {
      compareQueryResults({ age: { $mod: [3, 1] } }, '$mod different values')
    })

    test('should match $regex with string pattern', () => {
      compareQueryResults({ name: { $regex: '^A' } }, '$regex string pattern')
    })

    test('should match $regex with options', () => {
      compareQueryResults({ 'profile.bio': { $regex: 'developer', $options: 'i' } }, '$regex with options')
    })

    test('should match $regex with RegExp object', () => {
      compareQueryResults({ name: /^A/i }, '$regex RegExp object')
    })

    test('should match $regex with complex pattern', () => {
      compareQueryResults({ 'profile.email': { $regex: '\\.com$' } }, '$regex complex pattern')
    })

    test('should match $where operator with function', () => {
      const whereFunc = function(this: any) { return this.age > 25 && this.score > 80 }
      compareQueryResults({ $where: whereFunc }, '$where function')
    })

    test('should match $where operator with string', () => {
      compareQueryResults({ $where: 'this.age > 25 && this.score > 80' }, '$where string')
    })
  })

  describe('Bitwise Operators', () => {
    test('should match $bitsAllSet operator', () => {
      compareQueryResults({ flags: { $bitsAllSet: 1 } }, '$bitsAllSet operator')
    })

    test('should match $bitsAnySet operator', () => {
      compareQueryResults({ flags: { $bitsAnySet: 3 } }, '$bitsAnySet operator')
    })

    test('should match $bitsAllClear operator', () => {
      compareQueryResults({ flags: { $bitsAllClear: 8 } }, '$bitsAllClear operator')
    })

    test('should match $bitsAnyClear operator', () => {
      compareQueryResults({ flags: { $bitsAnyClear: 7 } }, '$bitsAnyClear operator')
    })

    test('should match bitwise operators with array positions', () => {
      compareQueryResults({ flags: { $bitsAllSet: [0, 2] } }, '$bitsAllSet array positions')
    })
  })

  describe('Text Search Operator', () => {
    test('should match $text operator', () => {
      compareQueryResults({
        'profile.bio': {
          $text: {
            $search: 'developer',
            $caseSensitive: false
          }
        }
      }, '$text operator')
    })

    test('should match $text with case sensitivity', () => {
      compareQueryResults({
        'profile.bio': {
          $text: {
            $search: 'DEVELOPER',
            $caseSensitive: true
          }
        }
      }, '$text case sensitive')
    })
  })

  describe('Complex Queries', () => {
    test('should match complex nested query', () => {
      compareQueryResults({
        $and: [
          { status: 'active' },
          {
            $or: [
              { age: { $gte: 30 } },
              { score: { $gt: 85 } }
            ]
          },
          { tags: { $nin: ['intern'] } },
          { 'profile.email': { $regex: '\\.com$' } }
        ]
      }, 'complex nested query')
    })

    test('should match query with mixed operators', () => {
      compareQueryResults({
        name: { $ne: 'Bob' },
        age: { $in: [25, 28, 30, 35] },
        score: { $gte: 80 },
        tags: { $all: ['developer'] },
        active: true,
        'metadata.version': { $type: 'number' }
      }, 'mixed operators query')
    })

    test('should match query with array operations', () => {
      compareQueryResults({
        $and: [
          { values: { $size: 4 } },
          { items: { $all: ['item1'] } },
          { tags: { $in: ['designer', 'ui-ux'] } }
        ]
      }, 'array operations query')
    })

    test('should match query with bitwise and regex', () => {
      compareQueryResults({
        $or: [
          { flags: { $bitsAllSet: 1 } },
          { 'profile.bio': { $regex: 'specialist', $options: 'i' } }
        ]
      }, 'bitwise and regex query')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty query', () => {
      compareQueryResults({}, 'empty query')
    })

    test('should handle query with undefined values', () => {
      compareQueryResults({ counter: undefined }, 'undefined value')
    })

    test('should handle query with nested undefined', () => {
      compareQueryResults({ 'profile.undefined': { $exists: false } }, 'nested undefined')
    })

    test('should handle regex with special characters', () => {
      compareQueryResults({ 'profile.email': { $regex: '\\@.*\\.org$' } }, 'regex special chars')
    })

    test('should handle $in with mixed types', () => {
      compareQueryResults({ counter: { $in: [null, 0, 42] } }, '$in mixed types')
    })

    test('should handle deeply nested fields', () => {
      compareQueryResults({ 'metadata.created': { $type: 'date' } }, 'deeply nested fields')
    })
  })
})