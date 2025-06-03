/**
 * Phase 5: Client Integration - Query Optimizer
 *
 * Оптимизация запросов для advanced pagination
 */

import { IQueryOptimizer } from './interfaces/IPagination'
import {
  SortConfig,
  PaginationConfig,
  QueryOptimizationOptions
} from './interfaces/types'

export class QueryOptimizer implements IQueryOptimizer {
  /**
   * Оптимизация запроса для пагинации
   */
  optimizeForPagination(
    query: Record<string, any>,
    config: PaginationConfig,
    options?: QueryOptimizationOptions
  ): Record<string, any> {
    let optimizedQuery = { ...query }

    // Применение index hints
    if (options?.useIndexHints) {
      const indexHints = this.generateIndexHints(config.sort, query)
      if (indexHints.length > 0) {
        optimizedQuery.$hint = indexHints
      }
    }

    // Ограничение сканирования документов
    if (options?.maxScanDocuments) {
      optimizedQuery.$maxScan = options.maxScanDocuments
    }

    // Предпочтительные индексы
    if (options?.preferredIndexes?.length) {
      optimizedQuery.$hint = options.preferredIndexes
    }

    // Оптимизация для больших datasets
    if (config.limit > 100) {
      optimizedQuery = this.optimizeForLargeDatasets(optimizedQuery, config)
    }

    // Оптимизация сложных сортировок
    if (config.sort.length > 2) {
      optimizedQuery = this.optimizeComplexSorting(optimizedQuery, config)
    }

    return optimizedQuery
  }

  /**
   * Генерация подсказок по индексам
   */
  generateIndexHints(sortConfig: SortConfig[], filters: Record<string, any>): string[] {
    const hints: string[] = []

    // Compound index для сортировки
    if (sortConfig.length > 1) {
      const compoundIndex = sortConfig
        .map(config => `${config.field}_${config.direction === 'asc' ? '1' : '-1'}`)
        .join('_')
      hints.push(compoundIndex)
    }

    // Single field indexes для сортировки
    for (const config of sortConfig) {
      hints.push(`${config.field}_${config.direction === 'asc' ? '1' : '-1'}`)
      hints.push(`${config.field}_1`) // fallback to ascending
    }

    // Indexes для фильтров
    for (const field of Object.keys(filters)) {
      if (!field.startsWith('$')) {
        hints.push(`${field}_1`)

        // Compound index с первым полем сортировки
        if (sortConfig.length > 0) {
          const firstSortField = sortConfig[0]
          hints.push(`${field}_1_${firstSortField.field}_${firstSortField.direction === 'asc' ? '1' : '-1'}`)
        }
      }
    }

    return hints
  }

  /**
   * Анализ производительности запроса
   */
  analyzeQueryPerformance(
    query: Record<string, any>,
    config: PaginationConfig
  ): {
    estimatedCost: number
    recommendedIndexes: string[]
    optimizationSuggestions: string[]
  } {
    const analysis = {
      estimatedCost: 0,
      recommendedIndexes: [] as string[],
      optimizationSuggestions: [] as string[]
    }

    // Анализ сложности сортировки
    const sortComplexity = this.calculateSortComplexity(config.sort)
    analysis.estimatedCost += sortComplexity

    // Анализ фильтров
    const filterComplexity = this.calculateFilterComplexity(query)
    analysis.estimatedCost += filterComplexity

    // Рекомендации по индексам
    analysis.recommendedIndexes = this.generateIndexHints(config.sort, query)

    // Предложения по оптимизации
    if (config.sort.length > 3) {
      analysis.optimizationSuggestions.push('Consider reducing the number of sort fields')
    }

    if (config.limit > 500) {
      analysis.optimizationSuggestions.push('Large page sizes may impact performance')
    }

    if (Object.keys(query).length > 5) {
      analysis.optimizationSuggestions.push('Complex filters may benefit from compound indexes')
    }

    if (sortComplexity > 50) {
      analysis.optimizationSuggestions.push('Complex sorting detected - ensure proper indexes exist')
    }

    return analysis
  }

  /**
   * Генерация плана выполнения запроса
   */
  generateQueryPlan(
    query: Record<string, any>,
    config: PaginationConfig
  ): {
    steps: string[]
    estimatedTime: number
    indexUsage: string[]
  } {
    const plan = {
      steps: [] as string[],
      estimatedTime: 0,
      indexUsage: [] as string[]
    }

    // Шаг 1: Применение фильтров
    if (Object.keys(query).length > 0) {
      plan.steps.push('Apply filters')
      plan.estimatedTime += this.calculateFilterComplexity(query) * 0.1
    }

    // Шаг 2: Сортировка
    if (config.sort.length > 0) {
      plan.steps.push('Apply sorting')
      plan.estimatedTime += this.calculateSortComplexity(config.sort) * 0.2
    }

    // Шаг 3: Применение курсора
    if (config.cursor) {
      plan.steps.push('Apply cursor conditions')
      plan.estimatedTime += 5 // базовая стоимость курсора
    }

    // Шаг 4: Ограничение результатов
    plan.steps.push('Limit results')
    plan.estimatedTime += 1

    // Анализ использования индексов
    plan.indexUsage = this.generateIndexHints(config.sort, query)

    return plan
  }

  /**
   * Оптимизация для больших datasets
   */
  private optimizeForLargeDatasets(
    query: Record<string, any>,
    config: PaginationConfig
  ): Record<string, any> {
    const optimized = { ...query }

    // Добавляем ограничение сканирования для больших datasets
    optimized.$maxScan = Math.max(config.limit * 10, 1000)

    // Предпочитаем использование индексов
    optimized.$hint = this.generateIndexHints(config.sort, query)

    return optimized
  }

  /**
   * Оптимизация сложных сортировок
   */
  private optimizeComplexSorting(
    query: Record<string, any>,
    config: PaginationConfig
  ): Record<string, any> {
    const optimized = { ...query }

    // Для сложных сортировок рекомендуем compound indexes
    const compoundIndexHint = config.sort
      .map(sort => `${sort.field}_${sort.direction === 'asc' ? '1' : '-1'}`)
      .join('_')

    optimized.$hint = [compoundIndexHint, ...(optimized.$hint || [])]

    // Ограничиваем сканирование для сложных сортировок
    optimized.$maxScan = config.limit * 5

    return optimized
  }

  /**
   * Расчет сложности сортировки
   */
  private calculateSortComplexity(sortConfig: SortConfig[]): number {
    let complexity = 0

    // Базовая сложность
    complexity += sortConfig.length * 10

    // Дополнительная сложность для разных типов данных
    for (const config of sortConfig) {
      switch (config.type) {
        case 'string':
          complexity += 5 // строки требуют больше ресурсов для сравнения
          break
        case 'date':
          complexity += 3
          break
        case 'number':
          complexity += 1
          break
        case 'boolean':
          complexity += 1
          break
      }

      // Дополнительная сложность для null handling
      if (config.nullsFirst !== undefined) {
        complexity += 2
      }
    }

    return complexity
  }

  /**
   * Расчет сложности фильтров
   */
  private calculateFilterComplexity(query: Record<string, any>): number {
    let complexity = 0

    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) {
        // Логические операторы
        if (key === '$and' || key === '$or') {
          complexity += Array.isArray(value) ? value.length * 5 : 5
        } else if (key === '$not') {
          complexity += 10
        }
      } else {
        // Обычные поля
        if (typeof value === 'object' && value !== null) {
          // Операторы сравнения
          complexity += Object.keys(value).length * 2
        } else {
          // Простое равенство
          complexity += 1
        }
      }
    }

    return complexity
  }
}