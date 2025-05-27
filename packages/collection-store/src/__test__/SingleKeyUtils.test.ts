import { SingleKeyUtils } from '../utils/SingleKeyUtils'

describe('SingleKeyUtils', () => {
  describe('createComparator', () => {
    describe('ascending order (default)', () => {
      const comparator = SingleKeyUtils.createComparator('asc')

      it('should handle numbers correctly', () => {
        expect(comparator(1, 2)).toBeLessThan(0)
        expect(comparator(2, 1)).toBeGreaterThan(0)
        expect(comparator(1, 1)).toBe(0)
      })

      it('should handle strings correctly', () => {
        expect(comparator('a', 'b')).toBeLessThan(0)
        expect(comparator('b', 'a')).toBeGreaterThan(0)
        expect(comparator('a', 'a')).toBe(0)
      })

      it('should handle booleans correctly', () => {
        expect(comparator(false, true)).toBeLessThan(0)
        expect(comparator(true, false)).toBeGreaterThan(0)
        expect(comparator(true, true)).toBe(0)
        expect(comparator(false, false)).toBe(0)
      })

      it('should handle dates correctly', () => {
        const date1 = new Date('2023-01-01')
        const date2 = new Date('2023-01-02')
        expect(comparator(date1, date2)).toBeLessThan(0)
        expect(comparator(date2, date1)).toBeGreaterThan(0)
        expect(comparator(date1, date1)).toBe(0)
      })

      it('should handle null values correctly', () => {
        expect(comparator(null, null)).toBe(0)
        expect(comparator(null, 1)).toBeLessThan(0)
        expect(comparator(1, null)).toBeGreaterThan(0)
      })

      it('should handle undefined values correctly', () => {
        expect(comparator(undefined, undefined)).toBe(0)
        expect(comparator(undefined, 1)).toBeLessThan(0)
        expect(comparator(1, undefined)).toBeGreaterThan(0)
      })

      it('should fallback to string comparison for mixed types', () => {
        expect(comparator(1, 'a')).toBeLessThan(0) // '1' < 'a'
        expect(comparator('a', 1)).toBeGreaterThan(0) // 'a' > '1'
      })
    })

    describe('descending order', () => {
      const comparator = SingleKeyUtils.createComparator('desc')

      it('should handle numbers correctly in descending order', () => {
        expect(comparator(1, 2)).toBeGreaterThan(0)
        expect(comparator(2, 1)).toBeLessThan(0)
        expect(comparator(1, 1)).toBe(0)
      })

      it('should handle strings correctly in descending order', () => {
        expect(comparator('a', 'b')).toBeGreaterThan(0)
        expect(comparator('b', 'a')).toBeLessThan(0)
        expect(comparator('a', 'a')).toBe(0)
      })

      it('should handle null values correctly in descending order', () => {
        expect(comparator(null, null)).toBe(0)
        expect(comparator(null, 1)).toBeGreaterThan(0)
        expect(comparator(1, null)).toBeLessThan(0)
      })
    })

    describe('default behavior', () => {
      it('should default to ascending order when no order specified', () => {
        const comparator = SingleKeyUtils.createComparator()
        expect(comparator(1, 2)).toBeLessThan(0)
        expect(comparator(2, 1)).toBeGreaterThan(0)
      })
    })
  })

  describe('validateSortOrder', () => {
    it('should validate correct sort orders', () => {
      expect(SingleKeyUtils.validateSortOrder('asc')).toBe(true)
      expect(SingleKeyUtils.validateSortOrder('desc')).toBe(true)
    })

    it('should reject invalid sort orders', () => {
      expect(SingleKeyUtils.validateSortOrder('invalid')).toBe(false)
      expect(SingleKeyUtils.validateSortOrder(null)).toBe(false)
      expect(SingleKeyUtils.validateSortOrder(undefined)).toBe(false)
      expect(SingleKeyUtils.validateSortOrder(123)).toBe(false)
    })
  })

  describe('normalizeSortOrder', () => {
    it('should return valid sort orders as-is', () => {
      expect(SingleKeyUtils.normalizeSortOrder('asc')).toBe('asc')
      expect(SingleKeyUtils.normalizeSortOrder('desc')).toBe('desc')
    })

    it('should default to asc for invalid values', () => {
      expect(SingleKeyUtils.normalizeSortOrder(undefined)).toBe('asc')
      expect(SingleKeyUtils.normalizeSortOrder('invalid' as any)).toBe('asc')
      expect(SingleKeyUtils.normalizeSortOrder(null as any)).toBe('asc')
    })
  })
})