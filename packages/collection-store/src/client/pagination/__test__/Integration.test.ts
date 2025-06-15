/**
 * Phase 5: Client Integration - Pagination Integration Tests
 *
 * Integration tests for the complete advanced pagination system
 */

import { CursorPaginationManager } from '../../../client/pagination/CursorPaginationManager'
import { SortingEngine } from '../../../client/pagination/SortingEngine'
import { QueryOptimizer } from '../../../client/pagination/QueryOptimizer'
import { SortConfig, PaginationConfig } from '../../../client/pagination/interfaces/types'

describe('Pagination Integration', () => {
  let paginationManager: CursorPaginationManager
  let sortingEngine: SortingEngine
  let queryOptimizer: QueryOptimizer

  beforeEach(() => {
    paginationManager = new CursorPaginationManager()
    sortingEngine = new SortingEngine()
    queryOptimizer = new QueryOptimizer()
  })

  describe('Complete Pagination Workflow', () => {
    it('should handle complete pagination workflow with sorting and optimization', () => {
      // Step 1: Define sort configuration
      const sortConfig: SortConfig[] = [
        { field: 'category', direction: 'asc', type: 'string' },
        { field: 'priority', direction: 'desc', type: 'number' },
        { field: 'createdAt', direction: 'asc', type: 'date' }
      ]

      // Step 2: Validate sort configuration
      expect(sortingEngine.validateSortConfig(sortConfig)).toBe(true)

      // Step 3: Create pagination config
      const paginationConfig: PaginationConfig = {
        limit: 10,
        sort: sortConfig,
        format: 'base64_json'
      }

      // Step 4: Optimize query
      const baseQuery = { status: 'active', department: 'engineering' }
      const optimizedQuery = queryOptimizer.optimizeForPagination(
        baseQuery,
        paginationConfig,
        { useIndexHints: true }
      )

      // Step 5: Verify optimization was applied
      expect(optimizedQuery.$hint).toBeDefined()
      expect(optimizedQuery.status).toBe('active')
      expect(optimizedQuery.department).toBe('engineering')

      // Step 6: Generate performance analysis
      const analysis = queryOptimizer.analyzeQueryPerformance(baseQuery, paginationConfig)
      expect(analysis.estimatedCost).toBeGreaterThan(0)
      expect(analysis.recommendedIndexes.length).toBeGreaterThan(0)
    })

    it('should handle cursor-based pagination flow', () => {
      // Step 1: Create initial cursor
      const sortValues = ['A', 100, '2023-01-01T00:00:00Z']
      const documentId = 'doc123'
      const cursor = paginationManager.encodeCursor(sortValues, documentId, {
        format: 'base64_json',
        includeTimestamp: true
      })

      // Step 2: Validate cursor
      expect(paginationManager.validateCursor(cursor)).toBe(true)

      // Step 3: Decode cursor
      const decodedCursor = paginationManager.decodeCursor(cursor)
      expect(decodedCursor.sortValues).toEqual(sortValues)
      expect(decodedCursor.documentId).toBe(documentId)
      expect(decodedCursor.timestamp).toBeGreaterThan(0)

      // Step 4: Use cursor in pagination config
      const paginationConfig: PaginationConfig = {
        limit: 10,
        cursor,
        sort: [
          { field: 'category', direction: 'asc', type: 'string' },
          { field: 'priority', direction: 'desc', type: 'number' },
          { field: 'createdAt', direction: 'asc', type: 'date' }
        ],
        format: 'base64_json'
      }

      // Step 5: Verify configuration is valid
      expect(sortingEngine.validateSortConfig(paginationConfig.sort)).toBe(true)
    })

    it('should handle simple_id format workflow', () => {
      // Step 1: Create simple_id cursor
      const sortValues = ['Alice', 25]
      const documentId = 'user123'
      const cursor = paginationManager.encodeCursor(sortValues, documentId, {
        format: 'simple_id'
      })

      // Step 2: Verify simple format
      expect(cursor).toBe('user123')

      // Step 3: Decode simple cursor
      const decodedCursor = paginationManager.decodeCursor(cursor)
      expect(decodedCursor.documentId).toBe('user123')
      expect(decodedCursor.sortValues).toEqual([])
      expect(decodedCursor.timestamp).toBe(0)

      // Step 4: Use in pagination
      const paginationConfig: PaginationConfig = {
        limit: 20,
        cursor,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'simple_id'
      }

      expect(paginationConfig.cursor).toBe('user123')
    })
  })

  describe('Performance Optimization Integration', () => {
    it('should integrate sorting optimization with query optimization', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' },
        { field: 'department', direction: 'asc', type: 'string' }
      ]

      const availableIndexes = ['name_1', 'age_-1', 'department_1_name_1']

      // Step 1: Optimize sort configuration for indexes
      const optimizedSort = sortingEngine.optimizeSortForIndexes(sortConfig, availableIndexes)

      // Step 2: Create pagination config with optimized sort
      const paginationConfig: PaginationConfig = {
        limit: 50,
        sort: optimizedSort,
        format: 'base64_json'
      }

      // Step 3: Generate index hints
      const baseQuery = { status: 'active' }
      const indexHints = queryOptimizer.generateIndexHints(optimizedSort, baseQuery)

      // Step 4: Verify optimization
      expect(indexHints).toContain('name_1')
      expect(indexHints).toContain('age_-1')
      expect(indexHints).toContain('status_1')

      // Step 5: Get performance hint
      const performanceHint = sortingEngine.getSortPerformanceHint(optimizedSort)
      expect(performanceHint).toContain('Multi-field sort')
    })

    it('should handle complex query optimization workflow', () => {
      const complexQuery = {
        status: 'active',
        department: { $in: ['engineering', 'design'] },
        level: { $gte: 'senior' },
        skills: { $all: ['javascript', 'typescript'] },
        location: 'remote'
      }

      const sortConfig: SortConfig[] = [
        { field: 'experience', direction: 'desc', type: 'number' },
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      const paginationConfig: PaginationConfig = {
        limit: 25,
        sort: sortConfig,
        filters: { active: true },
        format: 'base64_json'
      }

      // Step 1: Analyze performance
      const analysis = queryOptimizer.analyzeQueryPerformance(complexQuery, paginationConfig)

      // Step 2: Generate query plan
      const queryPlan = queryOptimizer.generateQueryPlan(complexQuery, paginationConfig)

      // Step 3: Optimize query
      const optimizedQuery = queryOptimizer.optimizeForPagination(
        complexQuery,
        paginationConfig,
        {
          useIndexHints: true,
          maxScanDocuments: 1000
        }
      )

      // Step 4: Verify results
      expect(analysis.estimatedCost).toBeGreaterThan(0)
      expect(queryPlan.steps.length).toBeGreaterThan(0)
      expect(optimizedQuery.$hint).toBeDefined()
      expect(optimizedQuery.$maxScan).toBe(1000)
    })
  })

  describe('Multi-field Sorting Integration', () => {
    it('should handle complex multi-field sorting with different types', () => {
      const sortConfig: SortConfig[] = [
        { field: 'priority', direction: 'desc', type: 'number', nullsFirst: false },
        { field: 'category', direction: 'asc', type: 'string', nullsFirst: true },
        { field: 'dueDate', direction: 'asc', type: 'date', nullsFirst: false },
        { field: 'completed', direction: 'desc', type: 'boolean' }
      ]

      // Step 1: Validate complex configuration
      expect(sortingEngine.validateSortConfig(sortConfig)).toBe(true)

      // Step 2: Normalize configuration
      const normalizedConfig = sortingEngine.normalizeSortConfig(sortConfig)
      expect(normalizedConfig).toHaveLength(4)

      // Step 3: Create comparator
      const comparator = sortingEngine.createSortComparator(normalizedConfig)

      // Step 4: Test comparator with sample data
      const item1 = {
        priority: 1,
        category: 'A',
        dueDate: '2023-01-01',
        completed: true
      }
      const item2 = {
        priority: 1,
        category: 'B',
        dueDate: '2023-01-02',
        completed: false
      }

      expect(comparator(item1, item2)).toBeLessThan(0) // A comes before B

      // Step 5: Apply to query
      const query = { status: 'active' }
      const queryWithSort = sortingEngine.applySortToQuery(query, normalizedConfig)

      expect(queryWithSort.$sort).toEqual({
        priority: -1,
        category: 1,
        dueDate: 1,
        completed: -1
      })
    })

    it('should handle nested field sorting integration', () => {
      const sortConfig: SortConfig[] = [
        { field: 'user.profile.name', direction: 'asc', type: 'string' },
        { field: 'metadata.score', direction: 'desc', type: 'number' },
        { field: 'timestamps.created', direction: 'asc', type: 'date' }
      ]

      // Step 1: Create comparator for nested fields
      const comparator = sortingEngine.createSortComparator(sortConfig)

      // Step 2: Test with nested data
      const item1 = {
        user: { profile: { name: 'Alice' } },
        metadata: { score: 95 },
        timestamps: { created: '2023-01-01' }
      }
      const item2 = {
        user: { profile: { name: 'Bob' } },
        metadata: { score: 90 },
        timestamps: { created: '2023-01-02' }
      }

      expect(comparator(item1, item2)).toBeLessThan(0) // Alice comes before Bob

      // Step 3: Create cursor with nested values
      const sortValues = ['Alice', 95, '2023-01-01']
      const cursor = paginationManager.encodeCursor(sortValues, 'doc1', {
        format: 'base64_json'
      })

      const decodedCursor = paginationManager.decodeCursor(cursor)
      expect(decodedCursor.sortValues).toEqual(sortValues)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle invalid configurations gracefully', () => {
      // Invalid sort configuration
      const invalidSortConfig: any[] = [
        { field: '', direction: 'invalid', type: 'unknown' }
      ]

      expect(sortingEngine.validateSortConfig(invalidSortConfig)).toBe(false)

      expect(() => {
        sortingEngine.applySortToQuery({}, invalidSortConfig)
      }).toThrow('Invalid sort configuration')

      expect(() => {
        sortingEngine.createSortComparator(invalidSortConfig)
      }).toThrow('Invalid sort configuration')
    })

    it('should handle cursor validation errors', () => {
      // Empty cursor
      expect(paginationManager.validateCursor('')).toBe(false)

      expect(() => {
        paginationManager.decodeCursor('')
      }).toThrow('Cursor cannot be empty')

      // Invalid base64 should fallback to simple_id
      const invalidCursor = 'not-valid-base64!'
      expect(paginationManager.validateCursor(invalidCursor)).toBe(true)

      const decoded = paginationManager.decodeCursor(invalidCursor)
      expect(decoded.documentId).toBe(invalidCursor)
      expect(decoded.sortValues).toEqual([])
    })

    it('should handle pagination validation errors', async () => {
      const invalidConfigs = [
        // Empty collection
        {
          collection: '',
          query: {},
          config: {
            limit: 10,
            sort: [{ field: 'name', direction: 'asc', type: 'string' }],
            format: 'base64_json' as const
          }
        },
        // Invalid limit
        {
          collection: 'users',
          query: {},
          config: {
            limit: 0,
            sort: [{ field: 'name', direction: 'asc', type: 'string' }],
            format: 'base64_json' as const
          }
        },
        // Invalid sort
        {
          collection: 'users',
          query: {},
          config: {
            limit: 10,
            sort: [{ field: '', direction: 'asc', type: 'string' }],
            format: 'base64_json' as const
          }
        }
      ]

      for (const { collection, query, config } of invalidConfigs) {
        await expect(
          paginationManager.paginate(collection, query, config)
        ).rejects.toThrow()
      }
    })
  })

  describe('Factory Function Integration', () => {
    it('should work with factory function pattern', () => {
      // Simulate factory function
      const createPaginationSystem = () => ({
        cursorManager: new CursorPaginationManager(),
        sortingEngine: new SortingEngine(),
        queryOptimizer: new QueryOptimizer()
      })

      const paginationSystem = createPaginationSystem()

             // Test that all components work together
       const sortConfig: SortConfig[] = [
         { field: 'name', direction: 'asc' as const, type: 'string' as const }
       ]

      expect(paginationSystem.sortingEngine.validateSortConfig(sortConfig)).toBe(true)

      const cursor = paginationSystem.cursorManager.encodeCursor(['Alice'], 'doc1')
      expect(paginationSystem.cursorManager.validateCursor(cursor)).toBe(true)

             const analysis = paginationSystem.queryOptimizer.analyzeQueryPerformance(
         { status: 'active' },
         { limit: 10, sort: sortConfig, format: 'base64_json' as const }
       )
      expect(analysis.estimatedCost).toBeGreaterThan(0)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle e-commerce product listing scenario', () => {
      const productQuery = {
        category: 'electronics',
        inStock: true,
        price: { $gte: 100, $lte: 1000 }
      }

      const sortConfig: SortConfig[] = [
        { field: 'featured', direction: 'desc', type: 'boolean' },
        { field: 'rating', direction: 'desc', type: 'number' },
        { field: 'price', direction: 'asc', type: 'number' },
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      const paginationConfig: PaginationConfig = {
        limit: 24,
        sort: sortConfig,
        format: 'base64_json'
      }

      // Validate configuration
      expect(sortingEngine.validateSortConfig(sortConfig)).toBe(true)

      // Optimize query
      const optimizedQuery = queryOptimizer.optimizeForPagination(
        productQuery,
        paginationConfig,
        { useIndexHints: true }
      )

      // Analyze performance
      const analysis = queryOptimizer.analyzeQueryPerformance(productQuery, paginationConfig)

      expect(optimizedQuery.$hint).toBeDefined()
      expect(analysis.recommendedIndexes).toContain('featured_-1')
      expect(analysis.recommendedIndexes).toContain('rating_-1')
    })

    it('should handle user search with filters scenario', () => {
      const userQuery = {
        department: { $in: ['engineering', 'design'] },
        level: { $gte: 'mid' },
        skills: { $all: ['javascript'] },
        active: true
      }

      const sortConfig: SortConfig[] = [
        { field: 'lastActive', direction: 'desc', type: 'date' },
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      const paginationConfig: PaginationConfig = {
        limit: 50,
        sort: sortConfig,
        filters: { verified: true },
        format: 'base64_json'
      }

      // Generate query plan
      const queryPlan = queryOptimizer.generateQueryPlan(userQuery, paginationConfig)

      // Optimize for performance
      const optimizedQuery = queryOptimizer.optimizeForPagination(
        userQuery,
        paginationConfig,
        {
          useIndexHints: true,
          maxScanDocuments: 2000
        }
      )

      expect(queryPlan.steps).toContain('Apply filters')
      expect(queryPlan.steps).toContain('Apply sorting')
      expect(optimizedQuery.$maxScan).toBe(2000)
      // Note: filters from paginationConfig are applied in paginate(), not in optimizeForPagination()
      expect(optimizedQuery.$hint).toBeDefined() // optimization applied
    })
  })
})