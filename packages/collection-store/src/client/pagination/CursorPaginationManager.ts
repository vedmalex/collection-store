/**
 * Phase 5: Client Integration - Cursor Pagination Manager
 *
 * Реализация cursor-based pagination с поддержкой simple_id и base64_json форматов
 */

import { ICursorPaginationManager } from './interfaces/IPagination'
import {
  SortConfig,
  PaginationConfig,
  CursorInfo,
  PaginatedResult,
  CursorCreationOptions,
  QueryOptimizationOptions
} from './interfaces/types'
import { SortingEngine } from './SortingEngine'

export class CursorPaginationManager implements ICursorPaginationManager {
  private sortingEngine: SortingEngine

  constructor() {
    this.sortingEngine = new SortingEngine()
  }

  /**
   * Кодирование курсора с поддержкой simple_id и base64_json форматов
   */
  encodeCursor(
    sortValues: any[],
    documentId: string,
    options?: CursorCreationOptions
  ): string {
    const format = options?.format || 'base64_json'
    const includeTimestamp = options?.includeTimestamp ?? true

    if (format === 'simple_id') {
      // Простой формат - только ID документа
      return documentId
    }

    // base64_json формат - полная информация о курсоре
    const cursorData: CursorInfo = {
      sortValues,
      documentId,
      timestamp: includeTimestamp ? Date.now() : 0
    }

    const jsonString = JSON.stringify(cursorData)
    return Buffer.from(jsonString).toString('base64')
  }

  /**
   * Декодирование курсора
   */
  decodeCursor(cursor: string): CursorInfo {
    if (!cursor) {
      throw new Error('Cursor cannot be empty')
    }

    // Попытка декодировать как base64_json
    try {
      const jsonString = Buffer.from(cursor, 'base64').toString('utf-8')
      const cursorData = JSON.parse(jsonString)

      if (this.isValidCursorInfo(cursorData)) {
        return cursorData
      }
    } catch (error) {
      // Если не удалось декодировать как base64_json, считаем что это simple_id
    }

    // Обработка как simple_id формат
    return {
      sortValues: [],
      documentId: cursor,
      timestamp: 0
    }
  }

  /**
   * Валидация курсора
   */
  validateCursor(cursor: string): boolean {
    try {
      this.decodeCursor(cursor)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Выполнение пагинации
   */
  async paginate<T>(
    collection: string,
    query: Record<string, any>,
    options: PaginationConfig
  ): Promise<PaginatedResult<T>> {
    // Валидация входных параметров
    if (!collection) {
      throw new Error('Collection name is required')
    }

    if (options.limit <= 0 || options.limit > 1000) {
      throw new Error('Limit must be between 1 and 1000')
    }

    if (!this.sortingEngine.validateSortConfig(options.sort)) {
      throw new Error('Invalid sort configuration')
    }

    // Построение запроса с курсором
    let enhancedQuery = { ...query }

    if (options.cursor) {
      const cursorInfo = this.decodeCursor(options.cursor)
      enhancedQuery = this.applyCursorConditions(enhancedQuery, cursorInfo, options.sort)
    }

    // Применение сортировки
    enhancedQuery = this.sortingEngine.applySortToQuery(enhancedQuery, options.sort)

    // Применение фильтров
    if (options.filters) {
      enhancedQuery = { ...enhancedQuery, ...options.filters }
    }

    // Выполнение запроса с лимитом +1 для определения hasMore
    // Здесь должен быть вызов к реальной коллекции
    // Пока используем заглушку для демонстрации логики
    const results = await this.executeQuery<T>(collection, enhancedQuery, options.limit + 1)

    const hasMore = results.length > options.limit
    const data = hasMore ? results.slice(0, -1) : results

    // Создание следующего курсора
    let nextCursor: string | undefined
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1]
      const sortValues = this.extractSortValues(lastItem, options.sort)
      const documentId = this.extractDocumentId(lastItem)

      nextCursor = this.encodeCursor(sortValues, documentId, {
        format: options.format,
        includeTimestamp: true
      })
    }

    return {
      data,
      nextCursor,
      hasMore,
      totalCount: undefined // cursor pagination не поддерживает точный count
    }
  }

  /**
   * Оптимизация запроса для пагинации
   */
  optimizePaginationQuery(
    query: Record<string, any>,
    config: PaginationConfig,
    optimizationOptions?: QueryOptimizationOptions
  ): Record<string, any> {
    let optimizedQuery = { ...query }

    // Применение index hints если включено
    if (optimizationOptions?.useIndexHints) {
      const indexHints = this.generateIndexHints(config.sort, query)
      if (indexHints.length > 0) {
        optimizedQuery.$hint = indexHints
      }
    }

    // Ограничение сканирования документов
    if (optimizationOptions?.maxScanDocuments) {
      optimizedQuery.$maxScan = optimizationOptions.maxScanDocuments
    }

    // Предпочтительные индексы
    if (optimizationOptions?.preferredIndexes?.length) {
      optimizedQuery.$hint = optimizationOptions.preferredIndexes
    }

    return optimizedQuery
  }

  /**
   * Применение условий курсора к запросу
   */
  private applyCursorConditions(
    query: Record<string, any>,
    cursorInfo: CursorInfo,
    sortConfig: SortConfig[]
  ): Record<string, any> {
    if (cursorInfo.sortValues.length === 0) {
      // Simple ID format - используем только ID
      return {
        ...query,
        _id: { $gt: cursorInfo.documentId }
      }
    }

    // Построение условий для multi-field sorting
    const conditions: any[] = []

    for (let i = 0; i < sortConfig.length; i++) {
      const field = sortConfig[i]
      const value = cursorInfo.sortValues[i]

      if (value === undefined) continue

      const condition: any = {}

      // Создаем условие для текущего поля
      if (field.direction === 'asc') {
        condition[field.field] = { $gt: value }
      } else {
        condition[field.field] = { $lt: value }
      }

      // Добавляем условия равенства для предыдущих полей
      const equalityConditions: any = {}
      for (let j = 0; j < i; j++) {
        const prevField = sortConfig[j]
        const prevValue = cursorInfo.sortValues[j]
        if (prevValue !== undefined) {
          equalityConditions[prevField.field] = prevValue
        }
      }

      if (Object.keys(equalityConditions).length > 0) {
        conditions.push({
          $and: [equalityConditions, condition]
        })
      } else {
        conditions.push(condition)
      }
    }

    // Добавляем условие по ID для обеспечения стабильной сортировки
    const lastCondition: any = {}
    for (let i = 0; i < sortConfig.length; i++) {
      const field = sortConfig[i]
      const value = cursorInfo.sortValues[i]
      if (value !== undefined) {
        lastCondition[field.field] = value
      }
    }
    lastCondition._id = { $gt: cursorInfo.documentId }
    conditions.push(lastCondition)

    return {
      ...query,
      $or: conditions
    }
  }

  /**
   * Извлечение значений сортировки из документа
   */
  private extractSortValues(item: any, sortConfig: SortConfig[]): any[] {
    return sortConfig.map(config => {
      return this.getNestedValue(item, config.field)
    })
  }

  /**
   * Извлечение ID документа
   */
  private extractDocumentId(item: any): string {
    return item._id || item.id || String(item)
  }

  /**
   * Получение значения по вложенному пути
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Валидация структуры CursorInfo
   */
  private isValidCursorInfo(data: any): data is CursorInfo {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.sortValues) &&
      typeof data.documentId === 'string' &&
      typeof data.timestamp === 'number'
    )
  }

  /**
   * Генерация подсказок по индексам
   */
  private generateIndexHints(sortConfig: SortConfig[], query: Record<string, any>): string[] {
    const hints: string[] = []

    // Добавляем подсказки для полей сортировки
    for (const config of sortConfig) {
      hints.push(`${config.field}_1`) // ascending index
      hints.push(`${config.field}_-1`) // descending index
    }

    // Добавляем подсказки для полей фильтрации
    for (const field of Object.keys(query)) {
      if (!field.startsWith('$')) {
        hints.push(`${field}_1`)
      }
    }

    return hints
  }

  /**
   * Заглушка для выполнения запроса
   * В реальной реализации здесь будет вызов к коллекции
   */
  private async executeQuery<T>(
    collection: string,
    query: Record<string, any>,
    limit: number
  ): Promise<T[]> {
    // TODO: Интегрировать с реальной системой коллекций
    // Пока возвращаем пустой массив для демонстрации
    return []
  }
}