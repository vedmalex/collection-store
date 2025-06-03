/**
 * Phase 5: Client Integration - Advanced Pagination Types
 *
 * Типы для cursor-based pagination с multi-field sorting
 * Поддержка simple_id и base64_json форматов
 */

export type SortDirection = 'asc' | 'desc'
export type CursorFormat = 'simple_id' | 'base64_json'

/**
 * Конфигурация сортировки для одного поля
 */
export interface SortConfig {
  field: string
  direction: SortDirection
  type: 'string' | 'number' | 'date' | 'boolean'
  nullsFirst?: boolean
}

/**
 * Конфигурация пагинации
 */
export interface PaginationConfig {
  limit: number
  cursor?: string
  sort: SortConfig[]
  filters?: Record<string, any>
  format: CursorFormat // выбор пользователя из плана
}

/**
 * Информация о курсоре
 */
export interface CursorInfo {
  sortValues: any[]
  documentId: string
  timestamp: number
}

/**
 * Результат пагинации
 */
export interface PaginatedResult<T> {
  data: T[]
  nextCursor?: string
  hasMore: boolean
  totalCount?: number // cursor pagination не поддерживает точный count
}

/**
 * Опции для оптимизации запросов
 */
export interface QueryOptimizationOptions {
  useIndexHints?: boolean
  maxScanDocuments?: number
  preferredIndexes?: string[]
  enableQueryPlan?: boolean
}

/**
 * Статистика производительности пагинации
 */
export interface PaginationPerformanceStats {
  queryTime: number
  documentsScanned: number
  documentsReturned: number
  indexesUsed: string[]
  optimizationApplied: boolean
}

/**
 * Результат с метриками производительности
 */
export interface PaginatedResultWithStats<T> extends PaginatedResult<T> {
  performanceStats: PaginationPerformanceStats
}

/**
 * Опции для создания курсора
 */
export interface CursorCreationOptions {
  format: CursorFormat
  includeTimestamp?: boolean
  customSeparator?: string
}

/**
 * Контекст выполнения пагинации
 */
export interface PaginationContext {
  collection: string
  query: Record<string, any>
  options: PaginationConfig
  startTime: number
}