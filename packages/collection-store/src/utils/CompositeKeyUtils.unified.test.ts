import { describe, test, expect } from 'bun:test'
import { CompositeKeyUtils } from '../utils/CompositeKeyUtils'
import { IndexField } from '../types/IndexDef'

interface TestItem {
  id: number
  name: string
  department: string
  salary: number
  joinDate: Date
  level: number
}

describe('CompositeKeyUtils Unified API', () => {
  const testItems: TestItem[] = [
    {
      id: 1,
      name: 'Alice Johnson',
      department: 'Engineering',
      salary: 95000,
      joinDate: new Date('2022-01-15'),
      level: 3
    },
    {
      id: 2,
      name: 'Bob Smith',
      department: 'Marketing',
      salary: 75000,
      joinDate: new Date('2021-06-10'),
      level: 2
    },
    {
      id: 3,
      name: 'Carol Davis',
      department: 'Engineering',
      salary: 85000,
      joinDate: new Date('2023-03-20'),
      level: 3
    }
  ]

  describe('isCompositeIndex', () => {
    test('should detect single key index', () => {
      const indexDef = { key: 'name' }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(false)
    })

    test('should detect composite index with multiple keys', () => {
      const indexDef = { keys: ['department', 'salary'] }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(true)
    })

    test('should not consider single key in array as composite', () => {
      const indexDef = { keys: ['name'] }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(false)
    })

    test('should handle empty keys array', () => {
      const indexDef = { keys: [] }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(false)
    })
  })

  describe('normalizeIndexFields', () => {
    test('should normalize single key definition', () => {
      const indexDef = { key: 'salary', order: 'desc' as const }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(1)
      expect(normalized[0].key).toBe('salary')
      expect(normalized[0].order).toBe('desc')
    })

    test('should normalize single key without order', () => {
      const indexDef = { key: 'name' }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(1)
      expect(normalized[0].key).toBe('name')
      expect(normalized[0].order).toBe('asc')
    })

    test('should normalize composite keys with strings', () => {
      const indexDef = { keys: ['department', 'salary', 'level'] }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(3)
      expect(normalized[0]).toEqual({ key: 'department', order: 'asc' })
      expect(normalized[1]).toEqual({ key: 'salary', order: 'asc' })
      expect(normalized[2]).toEqual({ key: 'level', order: 'asc' })
    })

    test('should normalize composite keys with mixed types', () => {
      const indexDef = {
        keys: [
          'department',
          { key: 'salary', order: 'desc' as const },
          { key: 'level', order: 'asc' as const },
          'name'
        ]
      }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(4)
      expect(normalized[0]).toEqual({ key: 'department', order: 'asc' })
      expect(normalized[1]).toEqual({ key: 'salary', order: 'desc' })
      expect(normalized[2]).toEqual({ key: 'level', order: 'asc' })
      expect(normalized[3]).toEqual({ key: 'name', order: 'asc' })
    })

    test('should handle IndexField objects without order', () => {
      const indexDef = {
        keys: [
          { key: 'department' },
          { key: 'salary', order: 'desc' as const }
        ]
      }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(2)
      expect(normalized[0]).toEqual({ key: 'department', order: 'asc' })
      expect(normalized[1]).toEqual({ key: 'salary', order: 'desc' })
    })

    test('should throw error for invalid definition', () => {
      const indexDef = {}
      expect(() => CompositeKeyUtils.normalizeIndexFields(indexDef)).toThrow(
        'Invalid index definition: must specify either key or keys'
      )
    })
  })

  describe('generateIndexName', () => {
    test('should generate name for single field', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'salary', order: 'asc' }
      ]
      const name = CompositeKeyUtils.generateIndexName(fields)
      expect(name).toBe('salary')
    })

    test('should generate name for composite fields with all ascending', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'asc' },
        { key: 'level', order: 'asc' }
      ]
      const name = CompositeKeyUtils.generateIndexName(fields)
      expect(name).toBe('department,salary,level')
    })

    test('should generate name for composite fields with mixed order', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'asc' }
      ]
      const name = CompositeKeyUtils.generateIndexName(fields)
      expect(name).toBe('department,salary:desc,level')
    })

    test('should generate name for all descending fields', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'desc' }
      ]
      const name = CompositeKeyUtils.generateIndexName(fields)
      expect(name).toBe('salary:desc,level:desc')
    })
  })

  describe('createProcessFunction', () => {
    test('should create process function for single field', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'salary', order: 'asc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)
      const result = processFunc(testItems[0])

      expect(result).toBe(95000)
    })

    test('should create process function for composite fields', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)
      const result = processFunc(testItems[0])

      expect(result).toBe('Engineering\u000095000')
    })

    test('should use custom separator', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'level', order: 'asc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields, '|')
      const result = processFunc(testItems[0])

      expect(result).toBe('Engineering|3')
    })

    test('should handle nested paths', () => {
      const item = {
        id: 1,
        metadata: {
          category: 'test',
          priority: 'high'
        }
      }
      const fields: IndexField<any>[] = [
        { key: 'metadata.category', order: 'asc' },
        { key: 'metadata.priority', order: 'asc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)
      const result = processFunc(item)

      expect(result).toBe('test\u0000high')
    })
  })

  describe('createComparator', () => {
    test('should return undefined for single ascending field', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'salary', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)
      expect(comparator).toBeUndefined()
    })

    test('should create comparator for single descending field', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'salary', order: 'desc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)
      expect(comparator).toBeDefined()

      expect(comparator!(100, 200)).toBeGreaterThan(0) // 100 > 200 in desc order
      expect(comparator!(200, 100)).toBeLessThan(0)    // 200 < 100 in desc order
      expect(comparator!(100, 100)).toBe(0)            // equal
    })

    test('should create comparator for composite fields with mixed order', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)
      expect(comparator).toBeDefined()

      // Same department, different salaries (desc order)
      const keyA = 'Engineering\u000085000'
      const keyB = 'Engineering\u000095000'
      expect(comparator!(keyA, keyB)).toBeGreaterThan(0) // Higher salary should come first
      expect(comparator!(keyB, keyA)).toBeLessThan(0)
    })

    test('should handle null values in comparison', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)
      expect(comparator).toBeDefined()

      const keyWithNull = 'Engineering\u0000'
      const keyWithValue = 'Engineering\u000095000'

      expect(comparator!(keyWithNull, keyWithValue)).toBeLessThan(0) // null < value in asc
      expect(comparator!(keyWithValue, keyWithNull)).toBeGreaterThan(0)
    })

    test('should handle different data types', () => {
      const fields: IndexField<any>[] = [
        { key: 'stringField', order: 'asc' },
        { key: 'numberField', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)
      expect(comparator).toBeDefined()

      const keyA = 'text\u000010'
      const keyB = 'text\u00005'
      expect(comparator!(keyA, keyB)).toBeLessThan(0) // String comparison: '10' < '5' lexicographically
    })
  })

  describe('Integration with serialization', () => {
    test('should work with serialize/deserialize', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'asc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)

      const serializedKey = processFunc(testItems[0])
      const deserializedValues = CompositeKeyUtils.deserialize(serializedKey)

      expect(deserializedValues).toEqual(['Engineering', '95000', '3'])
    })

    test('should maintain sort order consistency', () => {
      const fields: IndexField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)
      const comparator = CompositeKeyUtils.createComparator(fields)

      const keyA = processFunc(testItems[0]) // Engineering, 95000
      const keyB = processFunc(testItems[2]) // Engineering, 85000

      // Higher salary should come first in desc order
      expect(comparator!(keyA, keyB)).toBeLessThan(0)
      expect(comparator!(keyB, keyA)).toBeGreaterThan(0)
    })
  })

  describe('Error handling', () => {
    test('should handle missing fields gracefully', () => {
      const fields: IndexField<any>[] = [
        { key: 'nonexistent', order: 'asc' },
        { key: 'department', order: 'asc' }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)
      const result = processFunc(testItems[0])

      // Should serialize undefined as empty string
      expect(result).toBe('\u0000Engineering')
    })

    test('should handle empty fields array', () => {
      const processFunc = CompositeKeyUtils.createProcessFunction([])
      expect(processFunc).toBeUndefined()
    })
  })

  describe('Performance considerations', () => {
    test('should handle large composite keys efficiently', () => {
      const fields: IndexField<any>[] = Array.from({ length: 10 }, (_, i) => ({
        key: `field${i}`,
        order: i % 2 === 0 ? 'asc' as const : 'desc' as const
      }))

      const item = Array.from({ length: 10 }, (_, i) => [`field${i}`, `value${i}`])
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

      const processFunc = CompositeKeyUtils.createProcessFunction(fields)
      const comparator = CompositeKeyUtils.createComparator(fields)

      const startTime = performance.now()
      const result = processFunc(item)
      const processTime = performance.now() - startTime

      expect(processTime).toBeLessThan(10) // Should be very fast
      expect(result).toContain('\u0000') // Should contain separators
      expect(comparator).toBeDefined()
    })
  })
})