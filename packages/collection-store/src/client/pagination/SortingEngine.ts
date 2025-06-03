/**
 * Phase 5: Client Integration - Sorting Engine
 *
 * Реализация multi-field sorting для advanced pagination
 */

import { ISortingEngine } from './interfaces/IPagination'
import { SortConfig, SortDirection } from './interfaces/types'

export class SortingEngine implements ISortingEngine {
  /**
   * Валидация конфигурации сортировки
   */
  validateSortConfig(sortConfig: SortConfig[]): boolean {
    if (!Array.isArray(sortConfig) || sortConfig.length === 0) {
      return false
    }

    for (const config of sortConfig) {
      if (!config.field || typeof config.field !== 'string') {
        return false
      }

      if (!['asc', 'desc'].includes(config.direction)) {
        return false
      }

      if (!['string', 'number', 'date', 'boolean'].includes(config.type)) {
        return false
      }
    }

    return true
  }

  /**
   * Нормализация конфигурации сортировки
   */
  normalizeSortConfig(sortConfig: SortConfig[]): SortConfig[] {
    return sortConfig.map(config => ({
      field: config.field,
      direction: config.direction || 'asc',
      type: config.type || 'string',
      nullsFirst: config.nullsFirst ?? false
    }))
  }

  /**
   * Применение сортировки к запросу
   */
  applySortToQuery(query: Record<string, any>, sortConfig: SortConfig[]): Record<string, any> {
    if (!this.validateSortConfig(sortConfig)) {
      throw new Error('Invalid sort configuration')
    }

    const normalizedConfig = this.normalizeSortConfig(sortConfig)
    const sortObject: Record<string, 1 | -1> = {}

    for (const config of normalizedConfig) {
      sortObject[config.field] = config.direction === 'asc' ? 1 : -1
    }

    return {
      ...query,
      $sort: sortObject
    }
  }

  /**
   * Создание компаратора для сортировки
   */
  createSortComparator(sortConfig: SortConfig[]): (a: any, b: any) => number {
    if (!this.validateSortConfig(sortConfig)) {
      throw new Error('Invalid sort configuration')
    }

    const normalizedConfig = this.normalizeSortConfig(sortConfig)

    return (a: any, b: any): number => {
      for (const config of normalizedConfig) {
        const aValue = this.getNestedValue(a, config.field)
        const bValue = this.getNestedValue(b, config.field)

        const comparison = this.compareValues(aValue, bValue, config)
        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison
        }
      }
      return 0
    }
  }

  /**
   * Оптимизация сортировки для индексов
   */
  optimizeSortForIndexes(sortConfig: SortConfig[], availableIndexes: string[]): SortConfig[] {
    // Переупорядочиваем поля сортировки для максимального использования индексов
    const optimized = [...sortConfig]

    // Приоритет полям, которые есть в индексах
    optimized.sort((a, b) => {
      const aHasIndex = availableIndexes.some(index => index.includes(a.field))
      const bHasIndex = availableIndexes.some(index => index.includes(b.field))

      if (aHasIndex && !bHasIndex) return -1
      if (!aHasIndex && bHasIndex) return 1
      return 0
    })

    return optimized
  }

  /**
   * Получение подсказки по производительности сортировки
   */
  getSortPerformanceHint(sortConfig: SortConfig[]): string {
    if (sortConfig.length === 0) {
      return 'No sorting applied'
    }

    if (sortConfig.length === 1) {
      return `Single field sort on '${sortConfig[0].field}' - optimal performance`
    }

    if (sortConfig.length <= 3) {
      return `Multi-field sort on ${sortConfig.length} fields - good performance with proper indexes`
    }

    return `Complex multi-field sort on ${sortConfig.length} fields - consider index optimization`
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
   * Сравнение значений с учетом типа и null handling
   */
  private compareValues(a: any, b: any, config: SortConfig): number {
    // Обработка null/undefined значений
    if (a == null && b == null) return 0
    if (a == null) return config.nullsFirst ? -1 : 1
    if (b == null) return config.nullsFirst ? 1 : -1

    // Сравнение по типу
    switch (config.type) {
      case 'number':
        return this.compareNumbers(a, b)

      case 'date':
        return this.compareDates(a, b)

      case 'boolean':
        return this.compareBooleans(a, b)

      case 'string':
      default:
        return this.compareStrings(a, b)
    }
  }

  /**
   * Сравнение чисел
   */
  private compareNumbers(a: any, b: any): number {
    const numA = Number(a)
    const numB = Number(b)

    if (isNaN(numA) && isNaN(numB)) return 0
    if (isNaN(numA)) return 1
    if (isNaN(numB)) return -1

    return numA - numB
  }

  /**
   * Сравнение дат
   */
  private compareDates(a: any, b: any): number {
    const dateA = new Date(a)
    const dateB = new Date(b)

    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0
    if (isNaN(dateA.getTime())) return 1
    if (isNaN(dateB.getTime())) return -1

    return dateA.getTime() - dateB.getTime()
  }

  /**
   * Сравнение булевых значений
   */
  private compareBooleans(a: any, b: any): number {
    const boolA = Boolean(a)
    const boolB = Boolean(b)

    if (boolA === boolB) return 0
    return boolA ? 1 : -1
  }

  /**
   * Сравнение строк
   */
  private compareStrings(a: any, b: any): number {
    const strA = String(a)
    const strB = String(b)

    return strA.localeCompare(strB)
  }
}