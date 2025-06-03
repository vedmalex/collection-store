/**
 * Phase 5: Client Integration - Advanced Pagination System
 *
 * Экспорт всех компонентов для cursor-based pagination с multi-field sorting
 */

// Core classes
import { CursorPaginationManager } from './CursorPaginationManager'
import { SortingEngine } from './SortingEngine'
import { QueryOptimizer } from './QueryOptimizer'

export { CursorPaginationManager } from './CursorPaginationManager'
export { SortingEngine } from './SortingEngine'
export { QueryOptimizer } from './QueryOptimizer'

// Interfaces
export {
  IAdvancedPagination,
  ICursorPaginationManager,
  ISortingEngine,
  IQueryOptimizer
} from './interfaces/IPagination'

// Types
export {
  CursorFormat,
  SortConfig,
  PaginationConfig,
  CursorInfo,
  PaginatedResult,
  QueryOptimizationOptions,
  PaginationPerformanceStats,
  PaginatedResultWithStats,
  CursorCreationOptions,
  PaginationContext
} from './interfaces/types'

// Re-export SortDirection for convenience
export type { SortDirection } from './interfaces/types'

// Convenience factory function
export function createAdvancedPagination() {
  return {
    cursorManager: new CursorPaginationManager(),
    sortingEngine: new SortingEngine(),
    queryOptimizer: new QueryOptimizer()
  }
}