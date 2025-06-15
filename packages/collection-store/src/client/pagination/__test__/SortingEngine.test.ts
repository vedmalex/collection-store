/**
 * Phase 5: Client Integration - SortingEngine Tests
 *
 * Comprehensive tests for multi-field sorting functionality
 */

import { SortingEngine } from '../../../client/pagination/SortingEngine'
import { SortConfig } from '../../../client/pagination/interfaces/types'

describe('SortingEngine', () => {
  let sortingEngine: SortingEngine

  beforeEach(() => {
    sortingEngine = new SortingEngine()
  })

  describe('validateSortConfig', () => {
    it('should validate correct sort configuration', () => {
      const validConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' }
      ]

      expect(sortingEngine.validateSortConfig(validConfig)).toBe(true)
    })

    it('should reject empty sort configuration', () => {
      expect(sortingEngine.validateSortConfig([])).toBe(false)
    })

    it('should reject invalid field names', () => {
      const invalidConfig: SortConfig[] = [
        { field: '', direction: 'asc', type: 'string' }
      ]

      expect(sortingEngine.validateSortConfig(invalidConfig)).toBe(false)
    })

    it('should reject invalid direction', () => {
      const invalidConfig: any[] = [
        { field: 'name', direction: 'invalid', type: 'string' }
      ]

      expect(sortingEngine.validateSortConfig(invalidConfig)).toBe(false)
    })

    it('should reject invalid type', () => {
      const invalidConfig: any[] = [
        { field: 'name', direction: 'asc', type: 'invalid' }
      ]

      expect(sortingEngine.validateSortConfig(invalidConfig)).toBe(false)
    })
  })

  describe('normalizeSortConfig', () => {
    it('should normalize sort configuration with defaults', () => {
      const config: any[] = [
        { field: 'name' },
        { field: 'age', direction: 'desc' }
      ]

      const normalized = sortingEngine.normalizeSortConfig(config)

      expect(normalized).toEqual([
        { field: 'name', direction: 'asc', type: 'string', nullsFirst: false },
        { field: 'age', direction: 'desc', type: 'string', nullsFirst: false }
      ])
    })

    it('should preserve explicit configuration', () => {
      const config: SortConfig[] = [
        { field: 'name', direction: 'desc', type: 'string', nullsFirst: true },
        { field: 'age', direction: 'asc', type: 'number', nullsFirst: false }
      ]

      const normalized = sortingEngine.normalizeSortConfig(config)

      expect(normalized).toEqual(config)
    })
  })

  describe('applySortToQuery', () => {
    it('should apply single field sort to query', () => {
      const query = { status: 'active' }
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      const result = sortingEngine.applySortToQuery(query, sortConfig)

      expect(result).toEqual({
        status: 'active',
        $sort: { name: 1 }
      })
    })

    it('should apply multi-field sort to query', () => {
      const query = { status: 'active' }
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' },
        { field: 'createdAt', direction: 'asc', type: 'date' }
      ]

      const result = sortingEngine.applySortToQuery(query, sortConfig)

      expect(result).toEqual({
        status: 'active',
        $sort: { name: 1, age: -1, createdAt: 1 }
      })
    })

    it('should throw error for invalid sort configuration', () => {
      const query = { status: 'active' }
      const invalidConfig: any[] = [
        { field: '', direction: 'asc', type: 'string' }
      ]

      expect(() => {
        sortingEngine.applySortToQuery(query, invalidConfig)
      }).toThrow('Invalid sort configuration')
    })
  })

  describe('createSortComparator', () => {
    it('should create comparator for string sorting', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { name: 'Alice' }
      const b = { name: 'Bob' }

      expect(comparator(a, b)).toBeLessThan(0)
      expect(comparator(b, a)).toBeGreaterThan(0)
      expect(comparator(a, a)).toBe(0)
    })

    it('should create comparator for number sorting', () => {
      const sortConfig: SortConfig[] = [
        { field: 'age', direction: 'desc', type: 'number' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { age: 25 }
      const b = { age: 30 }

      expect(comparator(a, b)).toBeGreaterThan(0) // desc order
      expect(comparator(b, a)).toBeLessThan(0)
      expect(comparator(a, a)).toBe(0)
    })

    it('should create comparator for date sorting', () => {
      const sortConfig: SortConfig[] = [
        { field: 'createdAt', direction: 'asc', type: 'date' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { createdAt: '2023-01-01' }
      const b = { createdAt: '2023-01-02' }

      expect(comparator(a, b)).toBeLessThan(0)
      expect(comparator(b, a)).toBeGreaterThan(0)
      expect(comparator(a, a)).toBe(0)
    })

    it('should create comparator for boolean sorting', () => {
      const sortConfig: SortConfig[] = [
        { field: 'active', direction: 'asc', type: 'boolean' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { active: false }
      const b = { active: true }

      expect(comparator(a, b)).toBeLessThan(0)
      expect(comparator(b, a)).toBeGreaterThan(0)
      expect(comparator(a, a)).toBe(0)
    })

    it('should handle null values with nullsFirst option', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string', nullsFirst: true }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { name: null }
      const b = { name: 'Alice' }

      expect(comparator(a, b)).toBeLessThan(0) // null first
      expect(comparator(b, a)).toBeGreaterThan(0)
    })

    it('should handle null values without nullsFirst option', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string', nullsFirst: false }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { name: null }
      const b = { name: 'Alice' }

      expect(comparator(a, b)).toBeGreaterThan(0) // null last
      expect(comparator(b, a)).toBeLessThan(0)
    })

    it('should handle multi-field sorting correctly', () => {
      const sortConfig: SortConfig[] = [
        { field: 'category', direction: 'asc', type: 'string' },
        { field: 'priority', direction: 'desc', type: 'number' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { category: 'A', priority: 1 }
      const b = { category: 'A', priority: 2 }
      const c = { category: 'B', priority: 1 }

      // Same category, different priority (desc)
      expect(comparator(a, b)).toBeGreaterThan(0)
      expect(comparator(b, a)).toBeLessThan(0)

      // Different category
      expect(comparator(a, c)).toBeLessThan(0)
      expect(comparator(c, a)).toBeGreaterThan(0)
    })

    it('should handle nested field paths', () => {
      const sortConfig: SortConfig[] = [
        { field: 'user.profile.name', direction: 'asc', type: 'string' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { user: { profile: { name: 'Alice' } } }
      const b = { user: { profile: { name: 'Bob' } } }

      expect(comparator(a, b)).toBeLessThan(0)
      expect(comparator(b, a)).toBeGreaterThan(0)
    })
  })

  describe('optimizeSortForIndexes', () => {
    it('should prioritize indexed fields', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' },
        { field: 'email', direction: 'asc', type: 'string' }
      ]

      const availableIndexes = ['age_1', 'email_-1']

      const optimized = sortingEngine.optimizeSortForIndexes(sortConfig, availableIndexes)

      // age and email should come first as they have indexes
      expect(optimized[0].field).toBe('age')
      expect(optimized[1].field).toBe('email')
      expect(optimized[2].field).toBe('name')
    })

    it('should preserve order when no indexes available', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' }
      ]

      const availableIndexes: string[] = []

      const optimized = sortingEngine.optimizeSortForIndexes(sortConfig, availableIndexes)

      expect(optimized).toEqual(sortConfig)
    })
  })

  describe('getSortPerformanceHint', () => {
    it('should return hint for no sorting', () => {
      const hint = sortingEngine.getSortPerformanceHint([])
      expect(hint).toBe('No sorting applied')
    })

    it('should return hint for single field sort', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      const hint = sortingEngine.getSortPerformanceHint(sortConfig)
      expect(hint).toBe("Single field sort on 'name' - optimal performance")
    })

    it('should return hint for multi-field sort', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' }
      ]

      const hint = sortingEngine.getSortPerformanceHint(sortConfig)
      expect(hint).toBe('Multi-field sort on 2 fields - good performance with proper indexes')
    })

    it('should return hint for complex sort', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' },
        { field: 'email', direction: 'asc', type: 'string' },
        { field: 'status', direction: 'desc', type: 'string' },
        { field: 'createdAt', direction: 'asc', type: 'date' }
      ]

      const hint = sortingEngine.getSortPerformanceHint(sortConfig)
      expect(hint).toBe('Complex multi-field sort on 5 fields - consider index optimization')
    })
  })

  describe('edge cases', () => {
    it('should handle invalid numbers gracefully', () => {
      const sortConfig: SortConfig[] = [
        { field: 'value', direction: 'asc', type: 'number' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { value: 'not-a-number' }
      const b = { value: 42 }
      const c = { value: 'also-not-a-number' }

      expect(comparator(a, b)).toBeGreaterThan(0) // NaN goes last
      expect(comparator(b, a)).toBeLessThan(0)
      expect(comparator(a, c)).toBe(0) // Both NaN
    })

    it('should handle invalid dates gracefully', () => {
      const sortConfig: SortConfig[] = [
        { field: 'date', direction: 'asc', type: 'date' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { date: 'invalid-date' }
      const b = { date: '2023-01-01' }
      const c = { date: 'also-invalid' }

      expect(comparator(a, b)).toBeGreaterThan(0) // Invalid date goes last
      expect(comparator(b, a)).toBeLessThan(0)
      expect(comparator(a, c)).toBe(0) // Both invalid
    })

    it('should handle missing nested fields', () => {
      const sortConfig: SortConfig[] = [
        { field: 'user.profile.name', direction: 'asc', type: 'string' }
      ]

      const comparator = sortingEngine.createSortComparator(sortConfig)

      const a = { user: { profile: { name: 'Alice' } } }
      const b = { user: {} } // missing profile
      const c = {} // missing user

      expect(comparator(a, b)).toBeLessThan(0) // Alice comes before undefined
      expect(comparator(a, c)).toBeLessThan(0) // Alice comes before undefined
      expect(comparator(b, c)).toBe(0) // Both undefined
    })
  })
})