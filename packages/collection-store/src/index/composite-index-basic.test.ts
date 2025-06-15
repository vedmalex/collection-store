import { describe, it, expect } from 'bun:test'
import { CompositeKeyUtils } from '../utils/CompositeKeyUtils'

describe('Composite Index Basic Functionality', () => {
  describe('CompositeKeyUtils Core Functions', () => {
    it('should serialize and deserialize composite keys correctly', () => {
      const values = ['Electronics', 999, 'Apple']
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)

      expect(deserialized).toEqual(['Electronics', '999', 'Apple'])
    })

    it('should handle null and undefined values', () => {
      const values = ['Electronics', null, undefined, 'Apple']
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)

      expect(deserialized).toEqual(['Electronics', null, null, 'Apple'])
    })

    it('should escape special characters correctly', () => {
      const values = ['Category\u0000with\u0000nulls', 'Value|with|pipes']
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)

      expect(deserialized).toEqual(values)
    })

    it('should use custom separator', () => {
      const values = ['Electronics', 'Apple', 'iPhone']
      const serialized = CompositeKeyUtils.serialize(values, '|')
      const deserialized = CompositeKeyUtils.deserialize(serialized, '|')

      expect(deserialized).toEqual(values)
      expect(serialized).toBe('Electronics|Apple|iPhone')
    })
  })

  describe('Index Field Normalization', () => {
    it('should normalize single key definition', () => {
      const indexDef = { key: 'price', order: 'desc' as const }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(1)
      expect(normalized[0]).toEqual({ key: 'price', order: 'desc' })
    })

    it('should normalize composite key definition', () => {
      const indexDef = {
        keys: [
          'category',
          { key: 'price', order: 'desc' as const },
          'brand'
        ]
      }
      const normalized = CompositeKeyUtils.normalizeIndexFields(indexDef)

      expect(normalized).toHaveLength(3)
      expect(normalized[0]).toEqual({ key: 'category', order: 'asc' })
      expect(normalized[1]).toEqual({ key: 'price', order: 'desc' })
      expect(normalized[2]).toEqual({ key: 'brand', order: 'asc' })
    })
  })

  describe('Index Name Generation', () => {
    it('should generate name for single field', () => {
      const fields = [{ key: 'price', order: 'asc' as const }]
      const name = CompositeKeyUtils.generateIndexName(fields)
      expect(name).toBe('price')
    })

    it('should generate name for composite fields', () => {
      const fields = [
        { key: 'category', order: 'asc' as const },
        { key: 'price', order: 'desc' as const },
        { key: 'brand', order: 'asc' as const }
      ]
      const name = CompositeKeyUtils.generateIndexName(fields)
      expect(name).toBe('category,price:desc,brand')
    })
  })

  describe('Process Function Creation', () => {
    const testItem = {
      id: 1,
      name: 'iPhone 15',
      category: 'Electronics',
      price: 999,
      brand: 'Apple'
    }

    it('should create process function for single field', () => {
      const fields = [{ key: 'price', order: 'asc' as const }]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)

      expect(processFunc).toBeDefined()
      expect(processFunc!(testItem)).toBe(999)
    })

    it('should create process function for composite fields', () => {
      const fields = [
        { key: 'category', order: 'asc' as const },
        { key: 'price', order: 'asc' as const }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields)

      expect(processFunc).toBeDefined()
      expect(processFunc!(testItem)).toBe('Electronics\u0000999')
    })

    it('should use custom separator in process function', () => {
      const fields = [
        { key: 'category', order: 'asc' as const },
        { key: 'brand', order: 'asc' as const }
      ]
      const processFunc = CompositeKeyUtils.createProcessFunction(fields, '|')

      expect(processFunc).toBeDefined()
      expect(processFunc!(testItem)).toBe('Electronics|Apple')
    })
  })

  describe('Comparator Creation', () => {
    it('should return undefined for single ascending field', () => {
      const fields = [{ key: 'price', order: 'asc' as const }]
      const comparator = CompositeKeyUtils.createComparator(fields)
      expect(comparator).toBeUndefined()
    })

    it('should create comparator for single descending field', () => {
      const fields = [{ key: 'price', order: 'desc' as const }]
      const comparator = CompositeKeyUtils.createComparator(fields)

      expect(comparator).toBeDefined()
      expect(comparator!(100, 200)).toBeGreaterThan(0) // 100 > 200 in desc order
      expect(comparator!(200, 100)).toBeLessThan(0)    // 200 < 100 in desc order
    })

    it('should create comparator for composite fields', () => {
      const fields = [
        { key: 'category', order: 'asc' as const },
        { key: 'price', order: 'desc' as const }
      ]
      const comparator = CompositeKeyUtils.createComparator(fields)

      expect(comparator).toBeDefined()

      // Same category, different prices (desc order)
      const keyA = 'Electronics\u000085000'
      const keyB = 'Electronics\u000095000'
      expect(comparator!(keyA, keyB)).toBeGreaterThan(0) // Higher price should come first
    })
  })

  describe('Index Detection', () => {
    it('should detect single key index', () => {
      const indexDef = { key: 'price' }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(false)
    })

    it('should detect composite index', () => {
      const indexDef = { keys: ['category', 'price'] }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(true)
    })

    it('should not consider single key in array as composite', () => {
      const indexDef = { keys: ['price'] }
      expect(CompositeKeyUtils.isCompositeIndex(indexDef)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty values', () => {
      const values = ['', null, undefined, 0, false]
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)

      expect(deserialized).toEqual([null, null, null, '0', 'false'])
    })

    it('should handle very long keys', () => {
      const values = Array(100).fill(0).map((_, i) => `value_${i}`)
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)

      expect(deserialized).toEqual(values)
    })

    it('should handle unicode characters', () => {
      const values = ['🚀', '测试', 'тест', '🎉']
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)

      expect(deserialized).toEqual(values)
    })
  })
})