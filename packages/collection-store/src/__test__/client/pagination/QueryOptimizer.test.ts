/**
 * Phase 5: Client Integration - QueryOptimizer Tests
 *
 * Comprehensive tests for query optimization functionality
 */

import { QueryOptimizer } from '../../../client/pagination/QueryOptimizer'
import { SortConfig, PaginationConfig } from '../../../client/pagination/interfaces/types'

describe('QueryOptimizer', () => {
  let queryOptimizer: QueryOptimizer

  beforeEach(() => {
    queryOptimizer = new QueryOptimizer()
  })

  describe('optimizeForPagination', () => {
    it('should apply index hints when enabled', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
      const options = { useIndexHints: true }

      const optimized = queryOptimizer.optimizeForPagination(query, config, options)

      expect(optimized.$hint).toBeDefined()
      expect(Array.isArray(optimized.$hint)).toBe(true)
      expect(optimized.$hint.length).toBeGreaterThan(0)
    })

    it('should apply maxScanDocuments limit', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
      const options = { maxScanDocuments: 1000 }

      const optimized = queryOptimizer.optimizeForPagination(query, config, options)

      expect(optimized.$maxScan).toBe(1000)
    })

    it('should apply preferred indexes', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
      const options = { preferredIndexes: ['name_1', 'status_1'] }

      const optimized = queryOptimizer.optimizeForPagination(query, config, options)

      expect(optimized.$hint).toEqual(['name_1', 'status_1'])
    })

    it('should optimize for large datasets', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 150, // > 100
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const optimized = queryOptimizer.optimizeForPagination(query, config)

      expect(optimized.$maxScan).toBeDefined()
      expect(optimized.$hint).toBeDefined()
    })

    it('should optimize complex sorting', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [
          { field: 'name', direction: 'asc', type: 'string' },
          { field: 'age', direction: 'desc', type: 'number' },
          { field: 'email', direction: 'asc', type: 'string' }
        ], // > 2 fields
        format: 'base64_json'
      }

      const optimized = queryOptimizer.optimizeForPagination(query, config)

      expect(optimized.$hint).toBeDefined()
      expect(optimized.$maxScan).toBeDefined()
    })

    it('should not modify query when no optimization needed', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const optimized = queryOptimizer.optimizeForPagination(query, config)

      expect(optimized).toEqual(query)
    })
  })

  describe('generateIndexHints', () => {
    it('should generate compound index hints for multi-field sorting', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' }
      ]
      const filters = { status: 'active' }

      const hints = queryOptimizer.generateIndexHints(sortConfig, filters)

      expect(hints).toContain('name_1_age_-1') // compound index
      expect(hints).toContain('name_1') // single field indexes
      expect(hints).toContain('age_-1')
      expect(hints).toContain('status_1') // filter index
    })

    it('should generate single field hints for single field sorting', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'desc', type: 'string' }
      ]
      const filters = {}

      const hints = queryOptimizer.generateIndexHints(sortConfig, filters)

      expect(hints).toContain('name_-1')
      expect(hints).toContain('name_1') // fallback
      expect(hints).not.toContain('name_1_') // no compound for single field
    })

    it('should generate filter-based hints', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]
      const filters = {
        status: 'active',
        department: 'engineering'
      }

      const hints = queryOptimizer.generateIndexHints(sortConfig, filters)

      expect(hints).toContain('status_1')
      expect(hints).toContain('department_1')
      expect(hints).toContain('status_1_name_1') // compound with sort
      expect(hints).toContain('department_1_name_1') // compound with sort
    })

    it('should ignore MongoDB operators in filters', () => {
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]
      const filters = {
        status: 'active',
        $or: [{ type: 'A' }, { type: 'B' }]
      }

      const hints = queryOptimizer.generateIndexHints(sortConfig, filters)

      expect(hints).toContain('status_1')
      expect(hints).not.toContain('$or_1') // should ignore $ operators
    })

    it('should handle empty sort and filters', () => {
      const sortConfig: SortConfig[] = []
      const filters = {}

      const hints = queryOptimizer.generateIndexHints(sortConfig, filters)

      expect(hints).toEqual([])
    })
  })

  describe('analyzeQueryPerformance', () => {
    it('should analyze simple query performance', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)

      expect(analysis.estimatedCost).toBeGreaterThan(0)
      expect(analysis.recommendedIndexes).toContain('name_1')
      expect(analysis.optimizationSuggestions).toEqual([])
    })

    it('should suggest optimization for complex sorting', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [
          { field: 'name', direction: 'asc', type: 'string' },
          { field: 'age', direction: 'desc', type: 'number' },
          { field: 'email', direction: 'asc', type: 'string' },
          { field: 'status', direction: 'desc', type: 'string' }
        ], // > 3 fields
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)

      expect(analysis.optimizationSuggestions).toContain('Consider reducing the number of sort fields')
    })

    it('should suggest optimization for large page sizes', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 600, // > 500
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)

      expect(analysis.optimizationSuggestions).toContain('Large page sizes may impact performance')
    })

    it('should suggest optimization for complex filters', () => {
      const query = {
        status: 'active',
        department: 'engineering',
        role: 'developer',
        level: 'senior',
        location: 'remote',
        skills: { $in: ['javascript', 'typescript'] }
      } // > 5 fields
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)

      expect(analysis.optimizationSuggestions).toContain('Complex filters may benefit from compound indexes')
    })

    it('should suggest optimization for complex sorting complexity', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [
          { field: 'name', direction: 'asc', type: 'string', nullsFirst: true },
          { field: 'description', direction: 'desc', type: 'string', nullsFirst: true },
          { field: 'content', direction: 'asc', type: 'string', nullsFirst: true },
          { field: 'title', direction: 'desc', type: 'string', nullsFirst: true },
          { field: 'summary', direction: 'asc', type: 'string', nullsFirst: true }
        ], // high complexity due to many string fields with nullsFirst
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)

      expect(analysis.optimizationSuggestions).toContain('Complex sorting detected - ensure proper indexes exist')
    })
  })

  describe('generateQueryPlan', () => {
    it('should generate plan for simple query', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const plan = queryOptimizer.generateQueryPlan(query, config)

      expect(plan.steps).toContain('Apply filters')
      expect(plan.steps).toContain('Apply sorting')
      expect(plan.steps).toContain('Limit results')
      expect(plan.estimatedTime).toBeGreaterThan(0)
      expect(plan.indexUsage.length).toBeGreaterThan(0)
    })

    it('should include cursor step when cursor provided', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        cursor: 'some-cursor',
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const plan = queryOptimizer.generateQueryPlan(query, config)

      expect(plan.steps).toContain('Apply cursor conditions')
    })

    it('should handle query without filters', () => {
      const query = {}
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const plan = queryOptimizer.generateQueryPlan(query, config)

      expect(plan.steps).not.toContain('Apply filters')
      expect(plan.steps).toContain('Apply sorting')
      expect(plan.steps).toContain('Limit results')
    })

    it('should handle query without sorting', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [],
        format: 'base64_json'
      }

      const plan = queryOptimizer.generateQueryPlan(query, config)

      expect(plan.steps).toContain('Apply filters')
      expect(plan.steps).not.toContain('Apply sorting')
      expect(plan.steps).toContain('Limit results')
    })
  })

  describe('complexity calculations', () => {
    it('should calculate sort complexity correctly', () => {
      const simpleSort: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]
      const complexSort: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string', nullsFirst: true },
        { field: 'age', direction: 'desc', type: 'number' },
        { field: 'createdAt', direction: 'asc', type: 'date', nullsFirst: true }
      ]

      const simpleAnalysis = queryOptimizer.analyzeQueryPerformance({}, {
        limit: 10,
        sort: simpleSort,
        format: 'base64_json'
      })

      const complexAnalysis = queryOptimizer.analyzeQueryPerformance({}, {
        limit: 10,
        sort: complexSort,
        format: 'base64_json'
      })

      expect(complexAnalysis.estimatedCost).toBeGreaterThan(simpleAnalysis.estimatedCost)
    })

    it('should calculate filter complexity correctly', () => {
      const simpleQuery = { status: 'active' }
      const complexQuery = {
        $and: [
          { status: 'active' },
          { $or: [{ type: 'A' }, { type: 'B' }] },
          { department: { $in: ['eng', 'design'] } }
        ]
      }

      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const simpleAnalysis = queryOptimizer.analyzeQueryPerformance(simpleQuery, config)
      const complexAnalysis = queryOptimizer.analyzeQueryPerformance(complexQuery, config)

      expect(complexAnalysis.estimatedCost).toBeGreaterThan(simpleAnalysis.estimatedCost)
    })
  })

  describe('optimization strategies', () => {
    it('should optimize for large datasets correctly', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 200,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      // @ts-ignore - accessing private method for testing
      const optimized = queryOptimizer.optimizeForLargeDatasets(query, config)

      expect(optimized.$maxScan).toBe(2000) // limit * 10
      expect(optimized.$hint).toBeDefined()
    })

    it('should optimize complex sorting correctly', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [
          { field: 'name', direction: 'asc', type: 'string' },
          { field: 'age', direction: 'desc', type: 'number' },
          { field: 'email', direction: 'asc', type: 'string' }
        ],
        format: 'base64_json'
      }

      // @ts-ignore - accessing private method for testing
      const optimized = queryOptimizer.optimizeComplexSorting(query, config)

      expect(optimized.$hint).toContain('name_1_age_-1_email_1')
      expect(optimized.$maxScan).toBe(50) // limit * 5
    })
  })

  describe('edge cases', () => {
    it('should handle empty sort configuration', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [],
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)
      const plan = queryOptimizer.generateQueryPlan(query, config)

      expect(analysis.estimatedCost).toBeGreaterThan(0)
      expect(plan.steps).not.toContain('Apply sorting')
    })

    it('should handle empty query', () => {
      const query = {}
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const analysis = queryOptimizer.analyzeQueryPerformance(query, config)
      const plan = queryOptimizer.generateQueryPlan(query, config)

      expect(analysis.estimatedCost).toBeGreaterThan(0)
      expect(plan.steps).not.toContain('Apply filters')
    })

    it('should handle very small limits', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 1,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const optimized = queryOptimizer.optimizeForPagination(query, config)

      // Should not trigger large dataset optimization
      expect(optimized).toEqual(query)
    })
  })
})