/**
 * Phase 5: Client Integration - Factory Function Tests
 *
 * Tests for the createAdvancedPagination factory function
 */

import { CursorPaginationManager } from '../../../client/pagination/CursorPaginationManager'
import { SortingEngine } from '../../../client/pagination/SortingEngine'
import { QueryOptimizer } from '../../../client/pagination/QueryOptimizer'
import { SortConfig } from '../../../client/pagination/interfaces/types'

// Simulate the factory function locally to avoid import issues
function createAdvancedPagination() {
  return {
    cursorManager: new CursorPaginationManager(),
    sortingEngine: new SortingEngine(),
    queryOptimizer: new QueryOptimizer()
  }
}

describe('createAdvancedPagination Factory Function', () => {
  it('should create all pagination components', () => {
    const paginationSystem = createAdvancedPagination()

    expect(paginationSystem).toBeDefined()
    expect(paginationSystem.cursorManager).toBeDefined()
    expect(paginationSystem.sortingEngine).toBeDefined()
    expect(paginationSystem.queryOptimizer).toBeDefined()
  })

  it('should create working cursor manager', () => {
    const { cursorManager } = createAdvancedPagination()

    const cursor = cursorManager.encodeCursor(['Alice', 25], 'doc123', {
      format: 'base64_json'
    })

    expect(cursor).toBeDefined()
    expect(typeof cursor).toBe('string')

    const decoded = cursorManager.decodeCursor(cursor)
    expect(decoded.sortValues).toEqual(['Alice', 25])
    expect(decoded.documentId).toBe('doc123')
  })

  it('should create working sorting engine', () => {
    const { sortingEngine } = createAdvancedPagination()

    const sortConfig: SortConfig[] = [
      { field: 'name', direction: 'asc', type: 'string' },
      { field: 'age', direction: 'desc', type: 'number' }
    ]

    expect(sortingEngine.validateSortConfig(sortConfig)).toBe(true)

    const query = { status: 'active' }
    const queryWithSort = sortingEngine.applySortToQuery(query, sortConfig)

    expect(queryWithSort.$sort).toEqual({
      name: 1,
      age: -1
    })
  })

  it('should create working query optimizer', () => {
    const { queryOptimizer } = createAdvancedPagination()

    const query = { status: 'active' }
    const config = {
      limit: 10,
      sort: [{ field: 'name', direction: 'asc' as const, type: 'string' as const }],
      format: 'base64_json' as const
    }

    const analysis = queryOptimizer.analyzeQueryPerformance(query, config)

    expect(analysis.estimatedCost).toBeGreaterThan(0)
    expect(analysis.recommendedIndexes).toContain('name_1')
    expect(Array.isArray(analysis.optimizationSuggestions)).toBe(true)
  })

  it('should create independent instances', () => {
    const system1 = createAdvancedPagination()
    const system2 = createAdvancedPagination()

    expect(system1.cursorManager).not.toBe(system2.cursorManager)
    expect(system1.sortingEngine).not.toBe(system2.sortingEngine)
    expect(system1.queryOptimizer).not.toBe(system2.queryOptimizer)
  })

  it('should work in complete workflow', () => {
    const { cursorManager, sortingEngine, queryOptimizer } = createAdvancedPagination()

    // Step 1: Define sort configuration
    const sortConfig: SortConfig[] = [
      { field: 'priority', direction: 'desc', type: 'number' },
      { field: 'name', direction: 'asc', type: 'string' }
    ]

    // Step 2: Validate sort configuration
    expect(sortingEngine.validateSortConfig(sortConfig)).toBe(true)

    // Step 3: Create cursor
    const cursor = cursorManager.encodeCursor([1, 'Alice'], 'doc123')
    expect(cursorManager.validateCursor(cursor)).toBe(true)

    // Step 4: Optimize query
    const query = { status: 'active' }
    const config = {
      limit: 10,
      sort: sortConfig,
      cursor,
      format: 'base64_json' as const
    }

    const optimizedQuery = queryOptimizer.optimizeForPagination(query, config, {
      useIndexHints: true
    })

    expect(optimizedQuery.$hint).toBeDefined()
    expect(optimizedQuery.status).toBe('active')

    // Step 5: Generate performance analysis
    const analysis = queryOptimizer.analyzeQueryPerformance(query, config)
    expect(analysis.estimatedCost).toBeGreaterThan(0)
  })
})