import { describe, it, expect, beforeEach } from 'bun:test'
import { CompositeKeyUtils } from '../../utils/CompositeKeyUtils'

describe('CompositeKeyUtils', () => {
  describe('serialize', () => {
    it('should serialize simple values', () => {
      const values = ['a', 'b', 'c']
      const result = CompositeKeyUtils.serialize(values)
      expect(result).toBe('a\u0000b\u0000c')
    })

    it('should handle null and undefined values', () => {
      const values = ['a', null, 'c', undefined, 'e']
      const result = CompositeKeyUtils.serialize(values)
      expect(result).toBe('a\u0000\u0000c\u0000\u0000e')
    })

    it('should handle empty array', () => {
      const values: any[] = []
      const result = CompositeKeyUtils.serialize(values)
      expect(result).toBe('')
    })

    it('should use custom separator', () => {
      const values = ['a', 'b', 'c']
      const result = CompositeKeyUtils.serialize(values, '|')
      expect(result).toBe('a|b|c')
    })

    it('should escape separator characters in values', () => {
      const values = ['a\u0000b', 'c', 'd\u0000e']
      const result = CompositeKeyUtils.serialize(values)
      expect(result).toBe('a\\\u0000b\u0000c\u0000d\\\u0000e')
    })

    it('should handle different data types', () => {
      const values = [123, true, new Date('2023-01-01'), 'string']
      const result = CompositeKeyUtils.serialize(values)
      expect(result).toContain('123')
      expect(result).toContain('true')
      expect(result).toContain('2023')
      expect(result).toContain('string')
    })

    it('should handle empty strings', () => {
      const values = ['a', '', 'c']
      const result = CompositeKeyUtils.serialize(values)
      expect(result).toBe('a\u0000\u0000c')
    })
  })

  describe('deserialize', () => {
    it('should deserialize simple values', () => {
      const serialized = 'a\u0000b\u0000c'
      const result = CompositeKeyUtils.deserialize(serialized)
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should handle null values', () => {
      const serialized = 'a\u0000\u0000c'
      const result = CompositeKeyUtils.deserialize(serialized)
      expect(result).toEqual(['a', null, 'c'])
    })

    it('should handle empty string', () => {
      const result = CompositeKeyUtils.deserialize('')
      expect(result).toEqual([])
    })

    it('should use custom separator', () => {
      const serialized = 'a|b|c'
      const result = CompositeKeyUtils.deserialize(serialized, '|')
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should unescape separator characters', () => {
      const serialized = 'a\\\u0000b\u0000c\u0000d\\\u0000e'
      const result = CompositeKeyUtils.deserialize(serialized)
      expect(result).toEqual(['a\u0000b', 'c', 'd\u0000e'])
    })

    it('should handle single value', () => {
      const serialized = 'single'
      const result = CompositeKeyUtils.deserialize(serialized)
      expect(result).toEqual(['single'])
    })
  })

  describe('compare', () => {
    it('should compare compound keys lexicographically', () => {
      const key1 = CompositeKeyUtils.serialize(['a', 'b'])
      const key2 = CompositeKeyUtils.serialize(['a', 'c'])
      expect(CompositeKeyUtils.compare(key1, key2)).toBeLessThan(0)
    })

    it('should handle equal keys', () => {
      const key1 = CompositeKeyUtils.serialize(['a', 'b'])
      const key2 = CompositeKeyUtils.serialize(['a', 'b'])
      expect(CompositeKeyUtils.compare(key1, key2)).toBe(0)
    })

    it('should handle reverse comparison', () => {
      const key1 = CompositeKeyUtils.serialize(['b', 'a'])
      const key2 = CompositeKeyUtils.serialize(['a', 'b'])
      expect(CompositeKeyUtils.compare(key1, key2)).toBeGreaterThan(0)
    })

    it('should handle different length keys', () => {
      const key1 = CompositeKeyUtils.serialize(['a'])
      const key2 = CompositeKeyUtils.serialize(['a', 'b'])
      expect(CompositeKeyUtils.compare(key1, key2)).toBeLessThan(0)
    })

    it('should handle numeric comparison as strings', () => {
      const key1 = CompositeKeyUtils.serialize(['1', '10'])
      const key2 = CompositeKeyUtils.serialize(['1', '2'])
      // String comparison: '10' < '2' lexicographically
      expect(CompositeKeyUtils.compare(key1, key2)).toBeLessThan(0)
    })
  })

  describe('extractValues', () => {
    const testItem = {
      id: 1,
      name: 'Test Item',
      category: 'electronics',
      price: 99.99,
      metadata: {
        brand: 'TestBrand',
        model: 'TestModel'
      },
      tags: ['tag1', 'tag2']
    }

    it('should extract simple property values', () => {
      const keyPaths = ['name', 'category', 'price']
      const result = CompositeKeyUtils.extractValues(testItem, keyPaths)
      expect(result).toEqual(['Test Item', 'electronics', 99.99])
    })

    it('should extract nested property values', () => {
      const keyPaths = ['metadata.brand', 'metadata.model']
      const result = CompositeKeyUtils.extractValues(testItem, keyPaths)
      expect(result).toEqual(['TestBrand', 'TestModel'])
    })

    it('should handle missing properties', () => {
      const keyPaths = ['name', 'nonexistent', 'category']
      const result = CompositeKeyUtils.extractValues(testItem, keyPaths)
      expect(result).toEqual(['Test Item', undefined, 'electronics'])
    })

    it('should handle array access', () => {
      const keyPaths = ['tags[0]', 'tags[1]']
      const result = CompositeKeyUtils.extractValues(testItem, keyPaths)
      expect(result).toEqual(['tag1', 'tag2'])
    })

    it('should handle mixed path types', () => {
      const keyPaths = ['id', 'metadata.brand', 'tags[0]']
      const result = CompositeKeyUtils.extractValues(testItem, keyPaths)
      expect(result).toEqual([1, 'TestBrand', 'tag1'])
    })
  })

  describe('createKey', () => {
    const testItem = {
      id: 1,
      category: 'electronics',
      priority: 'high',
      createdAt: new Date('2023-01-01')
    }

    it('should create compound key from item', () => {
      const keyPaths = ['category', 'priority']
      const result = CompositeKeyUtils.createKey(testItem, keyPaths)
      expect(result).toBe('electronics\u0000high')
    })

    it('should use custom separator', () => {
      const keyPaths = ['category', 'priority']
      const result = CompositeKeyUtils.createKey(testItem, keyPaths, '|')
      expect(result).toBe('electronics|high')
    })

    it('should handle single key path', () => {
      const keyPaths = ['category']
      const result = CompositeKeyUtils.createKey(testItem, keyPaths)
      expect(result).toBe('electronics')
    })
  })

  describe('validateKeyPaths', () => {
    it('should validate correct key paths', () => {
      const keyPaths = ['field1', 'field2', 'nested.field']
      expect(CompositeKeyUtils.validateKeyPaths(keyPaths)).toBe(true)
    })

    it('should reject empty array', () => {
      expect(CompositeKeyUtils.validateKeyPaths([])).toBe(false)
    })

    it('should reject non-array input', () => {
      expect(CompositeKeyUtils.validateKeyPaths('not-array' as any)).toBe(false)
    })

    it('should reject empty strings', () => {
      const keyPaths = ['field1', '', 'field3']
      expect(CompositeKeyUtils.validateKeyPaths(keyPaths)).toBe(false)
    })

    it('should reject non-string paths', () => {
      const keyPaths = ['field1', 123, 'field3'] as any
      expect(CompositeKeyUtils.validateKeyPaths(keyPaths)).toBe(false)
    })
  })

  describe('generateIndexName', () => {
    it('should generate index name from key paths', () => {
      const keyPaths = ['category', 'priority', 'status']
      const result = CompositeKeyUtils.generateIndexName(keyPaths)
      expect(result).toBe('category,priority,status')
    })

    it('should handle single key path', () => {
      const keyPaths = ['category']
      const result = CompositeKeyUtils.generateIndexName(keyPaths)
      expect(result).toBe('category')
    })

    it('should handle nested paths', () => {
      const keyPaths = ['metadata.brand', 'metadata.model']
      const result = CompositeKeyUtils.generateIndexName(keyPaths)
      expect(result).toBe('metadata.brand,metadata.model')
    })
  })

  describe('isEmptyValue', () => {
    it('should identify null as empty', () => {
      expect(CompositeKeyUtils.isEmptyValue(null)).toBe(true)
    })

    it('should identify undefined as empty', () => {
      expect(CompositeKeyUtils.isEmptyValue(undefined)).toBe(true)
    })

    it('should identify empty string as empty', () => {
      expect(CompositeKeyUtils.isEmptyValue('')).toBe(true)
    })

    it('should not identify zero as empty', () => {
      expect(CompositeKeyUtils.isEmptyValue(0)).toBe(false)
    })

    it('should not identify false as empty', () => {
      expect(CompositeKeyUtils.isEmptyValue(false)).toBe(false)
    })

    it('should not identify non-empty string as empty', () => {
      expect(CompositeKeyUtils.isEmptyValue('value')).toBe(false)
    })
  })

  describe('createPartialKey', () => {
    it('should create partial key with all values', () => {
      const values = ['a', 'b', 'c']
      const result = CompositeKeyUtils.createPartialKey(values)
      expect(result).toBe('a\u0000b\u0000c')
    })

    it('should create partial key stopping at undefined', () => {
      const values = ['a', 'b', undefined, 'c']
      const result = CompositeKeyUtils.createPartialKey(values)
      expect(result).toBe('a\u0000b')
    })

    it('should handle leading undefined', () => {
      const values = [undefined, 'b', 'c']
      const result = CompositeKeyUtils.createPartialKey(values)
      expect(result).toBe('')
    })

    it('should handle all undefined', () => {
      const values = [undefined, undefined, undefined]
      const result = CompositeKeyUtils.createPartialKey(values)
      expect(result).toBe('')
    })

    it('should include null values but stop at undefined', () => {
      const values = ['a', null, 'c', undefined, 'e']
      const result = CompositeKeyUtils.createPartialKey(values)
      expect(result).toBe('a\u0000\u0000c')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long compound keys', () => {
      const values = Array(100).fill(0).map((_, i) => `value_${i}`)
      const serialized = CompositeKeyUtils.serialize(values)
      const deserialized = CompositeKeyUtils.deserialize(serialized)
      expect(deserialized).toEqual(values)
    })

    it('should handle special characters in values', () => {
      const values = ['value with spaces', 'value\nwith\nnewlines', 'value\twith\ttabs']
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

    it('should maintain order consistency', () => {
      const values1 = ['a', 'b', 'c']
      const values2 = ['a', 'b', 'd']
      const key1 = CompositeKeyUtils.serialize(values1)
      const key2 = CompositeKeyUtils.serialize(values2)

      expect(CompositeKeyUtils.compare(key1, key2)).toBeLessThan(0)
      expect(CompositeKeyUtils.compare(key2, key1)).toBeGreaterThan(0)
    })
  })
})