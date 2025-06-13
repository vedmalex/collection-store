/**
 * Phase 5: Client Integration - Advanced Pagination Interfaces
 *
 * Интерфейсы для cursor-based pagination с multi-field sorting
 */

import {
  SortConfig,
  PaginationConfig,
  CursorInfo,
  PaginatedResult,
  PaginatedResultWithStats,
  QueryOptimizationOptions,
  CursorCreationOptions,
  PaginationContext
} from './types'

/**
 * Основной интерфейс для advanced pagination
 */
export interface IAdvancedPagination {
  // Cursor management
  createCursor(lastItem: any, sortFields: SortConfig[], options?: CursorCreationOptions): string
  parseCursor(cursor: string): CursorInfo

  // Multi-field sorting
  applySorting(query: any, sortConfig: SortConfig[]): any

  // Performance optimization
  optimizeQuery(query: any, pagination: PaginationConfig, options?: QueryOptimizationOptions): any

  // Client-side helpers
  generateClientPagination<T>(data: T[], config: PaginationConfig): PaginatedResult<T>

  // Performance monitoring
  measurePerformance<T>(
    operation: () => Promise<PaginatedResult<T>>,
    context: PaginationContext
  ): Promise<PaginatedResultWithStats<T>>
}

/**
 * Интерфейс для cursor-based pagination manager
 */
export interface ICursorPaginationManager {
  // Cursor operations
  encodeCursor(sortValues: any[], documentId: string, options?: CursorCreationOptions): string
  decodeCursor(cursor: string): CursorInfo
  validateCursor(cursor: string): boolean

  // Pagination execution
  paginate<T>(
    collection: string,
    query: Record<string, any>,
    options: PaginationConfig
  ): Promise<PaginatedResult<T>>

  // Performance optimization
  optimizePaginationQuery(
    query: Record<string, any>,
    config: PaginationConfig,
    optimizationOptions?: QueryOptimizationOptions
  ): Record<string, any>
}

/**
 * Интерфейс для sorting engine
 */
export interface ISortingEngine {
  // Sort configuration
  validateSortConfig(sortConfig: SortConfig[]): boolean
  normalizeSortConfig(sortConfig: SortConfig[]): SortConfig[]

  // Sort application
  applySortToQuery(query: Record<string, any>, sortConfig: SortConfig[]): Record<string, any>
  createSortComparator(sortConfig: SortConfig[]): (a: any, b: any) => number

  // Sort optimization
  optimizeSortForIndexes(sortConfig: SortConfig[], availableIndexes: string[]): SortConfig[]
  getSortPerformanceHint(sortConfig: SortConfig[]): string
}

/**
 * Интерфейс для query optimizer
 */
export interface IQueryOptimizer {
  // Query optimization
  optimizeForPagination(
    query: Record<string, any>,
    config: PaginationConfig,
    options?: QueryOptimizationOptions
  ): Record<string, any>

  // Index hints
  generateIndexHints(sortConfig: SortConfig[], filters: Record<string, any>): string[]

  // Performance analysis
  analyzeQueryPerformance(
    query: Record<string, any>,
    config: PaginationConfig
  ): {
    estimatedCost: number
    recommendedIndexes: string[]
    optimizationSuggestions: string[]
  }

  // Query plan
  generateQueryPlan(
    query: Record<string, any>,
    config: PaginationConfig
  ): {
    steps: string[]
    estimatedTime: number
    indexUsage: string[]
  }
}