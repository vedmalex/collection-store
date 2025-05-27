import { describe, test, expect } from 'bun:test'
import { CompositeKeyUtils } from '../utils/CompositeKeyUtils'
import { CompositeKeyField, SortOrder } from '../types/IndexDef'

interface TestItem {
  id: number
  name: string
  department: string
  salary: number
  joinDate: Date
  level: number
}

describe('CompositeKeyUtils Sort Order', () => {
  const testItems: TestItem[] = [
    {
      id: 1,
      name: 'Alice',
      department: 'Engineering',
      salary: 95000,
      joinDate: new Date('2020-01-15'),
      level: 3
    },
    {
      id: 2,
      name: 'Bob',
      department: 'Engineering',
      salary: 85000,
      joinDate: new Date('2019-03-10'),
      level: 2
    },
    {
      id: 3,
      name: 'Charlie',
      department: 'Marketing',
      salary: 75000,
      joinDate: new Date('2021-06-01'),
      level: 3
    },
    {
      id: 4,
      name: 'Diana',
      department: 'Engineering',
      salary: 95000,
      joinDate: new Date('2018-08-22'),
      level: 3
    }
  ]

  describe('normalizeCompositeKeys', () => {
    test('should normalize string keys to CompositeKeyField with asc order', () => {
      const keys = ['department', 'salary']
      const normalized = CompositeKeyUtils.normalizeCompositeKeys(keys)

      expect(normalized).toEqual([
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'asc' }
      ])
    })

    test('should preserve CompositeKeyField objects', () => {
      const keys: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const normalized = CompositeKeyUtils.normalizeCompositeKeys(keys)

      expect(normalized).toEqual([
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ])
    })

    test('should handle mixed key types', () => {
      const keys = [
        'department',
        { key: 'salary', order: 'desc' as SortOrder },
        'level'
      ]
      const normalized = CompositeKeyUtils.normalizeCompositeKeys(keys)

      expect(normalized).toEqual([
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'asc' }
      ])
    })

    test('should default to asc when order is not specified', () => {
      const keys = [{ key: 'department' }]
      const normalized = CompositeKeyUtils.normalizeCompositeKeys(keys)

      expect(normalized).toEqual([
        { key: 'department', order: 'asc' }
      ])
    })
  })

  describe('extractValuesWithOrder', () => {
    test('should extract values using normalized fields', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const values = CompositeKeyUtils.extractValuesWithOrder(testItems[0], fields)

      expect(values).toEqual(['Engineering', 95000])
    })

    test('should handle nested paths', () => {
      const item = { user: { profile: { name: 'John' } }, id: 1 }
      const fields: CompositeKeyField<any>[] = [{ key: 'user.profile.name', order: 'asc' }]
      const values = CompositeKeyUtils.extractValuesWithOrder(item, fields)

      expect(values).toEqual(['John'])
    })
  })

  describe('createComparator', () => {
    test('should create comparator for ascending order', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      const keyA = 'Engineering\u0000085000'
      const keyB = 'Engineering\u0000095000'

      expect(comparator(keyA, keyB)).toBeLessThan(0) // 85000 < 95000
      expect(comparator(keyB, keyA)).toBeGreaterThan(0) // 95000 > 85000
    })

    test('should create comparator for descending order', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      const keyA = 'Engineering\u0000085000'
      const keyB = 'Engineering\u0000095000'

      expect(comparator(keyA, keyB)).toBeGreaterThan(0) // desc: 85000 > 95000
      expect(comparator(keyB, keyA)).toBeLessThan(0) // desc: 95000 < 85000
    })

    test('should handle mixed sort orders', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      // Same department, different salaries (desc), same level
      const keyA = 'Engineering\u0000085000\u00003'
      const keyB = 'Engineering\u0000095000\u00003'

      expect(comparator(keyA, keyB)).toBeGreaterThan(0) // Higher salary should come first (desc)
    })

    test('should handle null values correctly', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      const keyWithNull = 'Engineering\u0000'
      const keyWithValue = 'Engineering\u000095000'

      expect(comparator(keyWithNull, keyWithValue)).toBeGreaterThan(0) // null comes after in desc
    })

    test('should handle Date values', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'joinDate', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      const date1 = new Date('2020-01-15').getTime().toString()
      const date2 = new Date('2021-01-15').getTime().toString()

      expect(comparator(date1, date2)).toBeLessThan(0) // Earlier date comes first
    })

    test('should handle string comparison', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'name', order: 'asc' }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      expect(comparator('Alice', 'Bob')).toBeLessThan(0)
      expect(comparator('Bob', 'Alice')).toBeGreaterThan(0)
      expect(comparator('Alice', 'Alice')).toBe(0)
    })
  })

  describe('createKeyWithOrder', () => {
    test('should create compound key using field order', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]
      const key = CompositeKeyUtils.createKeyWithOrder(testItems[0], fields)

      expect(key).toBe('Engineering\u000095000')
    })

    test('should handle custom separator', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'level', order: 'asc' }
      ]
      const key = CompositeKeyUtils.createKeyWithOrder(testItems[0], fields, '|')

      expect(key).toBe('Engineering|3')
    })
  })

  describe('validateCompositeKeyFields', () => {
    test('should validate correct compound key fields', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' }
      ]

      expect(CompositeKeyUtils.validateCompositeKeyFields(fields)).toBe(true)
    })

    test('should reject empty array', () => {
      expect(CompositeKeyUtils.validateCompositeKeyFields([])).toBe(false)
    })

    test('should reject non-array input', () => {
      expect(CompositeKeyUtils.validateCompositeKeyFields(null as any)).toBe(false)
      expect(CompositeKeyUtils.validateCompositeKeyFields(undefined as any)).toBe(false)
    })

    test('should reject fields without key', () => {
      const fields = [{ order: 'asc' }] as any
      expect(CompositeKeyUtils.validateCompositeKeyFields(fields)).toBe(false)
    })

    test('should reject fields with empty key', () => {
      const fields: CompositeKeyField<any>[] = [{ key: '', order: 'asc' }]
      expect(CompositeKeyUtils.validateCompositeKeyFields(fields)).toBe(false)
    })

    test('should reject invalid sort order', () => {
      const fields = [{ key: 'department', order: 'invalid' }] as any
      expect(CompositeKeyUtils.validateCompositeKeyFields(fields)).toBe(false)
    })

    test('should accept fields without order (defaults to asc)', () => {
      const fields: CompositeKeyField<any>[] = [{ key: 'department' }]
      expect(CompositeKeyUtils.validateCompositeKeyFields(fields)).toBe(true)
    })
  })

  describe('generateIndexNameFromFields', () => {
    test('should generate index name with sort order', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'asc' }
      ]
      const name = CompositeKeyUtils.generateIndexNameFromFields(fields)

      expect(name).toBe('department,salary:desc,level')
    })

    test('should omit :asc for ascending fields', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'name', order: 'asc' }
      ]
      const name = CompositeKeyUtils.generateIndexNameFromFields(fields)

      expect(name).toBe('department,name')
    })

    test('should handle single field', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'salary', order: 'desc' }
      ]
      const name = CompositeKeyUtils.generateIndexNameFromFields(fields)

      expect(name).toBe('salary:desc')
    })
  })

  describe('Integration Tests', () => {
    test('should sort items correctly with mixed order', () => {
      // Department ASC, Salary DESC, Level ASC
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'salary', order: 'desc' },
        { key: 'level', order: 'asc' }
      ]

      const keys = testItems.map(item =>
        CompositeKeyUtils.createKeyWithOrder(item, fields)
      )

      const comparator = CompositeKeyUtils.createComparator(fields)
      const sortedKeys = [...keys].sort(comparator)

      // Expected order:
      // 1. Engineering, 95000, 3 (Alice - level 3)
      // 2. Engineering, 95000, 3 (Diana - level 3)
      // 3. Engineering, 85000, 2 (Bob)
      // 4. Marketing, 75000, 3 (Charlie)

      expect(sortedKeys[0]).toBe('Engineering\u000095000\u00003') // Alice or Diana
      expect(sortedKeys[2]).toBe('Engineering\u000085000\u00002') // Bob
      expect(sortedKeys[3]).toBe('Marketing\u000075000\u00003') // Charlie
    })

    test('should handle date sorting correctly', () => {
      const fields: CompositeKeyField<TestItem>[] = [
        { key: 'department', order: 'asc' },
        { key: 'joinDate', order: 'asc' } // Earlier dates first
      ]

      const keys = testItems.map(item => {
        const values = CompositeKeyUtils.extractValuesWithOrder(item, fields)
        // Convert date to timestamp for proper comparison
        values[1] = values[1].getTime()
        return CompositeKeyUtils.serialize(values)
      })

      const comparator = CompositeKeyUtils.createComparator(fields)
      const sortedKeys = [...keys].sort(comparator)

      // Diana (2018) should come before Bob (2019) should come before Alice (2020)
      // All in Engineering department
      const dianaKey = keys[3] // Diana
      const bobKey = keys[1]   // Bob
      const aliceKey = keys[0] // Alice

      expect(sortedKeys.indexOf(dianaKey)).toBeLessThan(sortedKeys.indexOf(bobKey))
      expect(sortedKeys.indexOf(bobKey)).toBeLessThan(sortedKeys.indexOf(aliceKey))
    })
  })
})