/**
 * Phase 5: Client Integration - Pagination Example
 *
 * Практический пример использования Advanced Pagination System
 */

import { CursorPaginationManager } from './CursorPaginationManager'
import { SortingEngine } from './SortingEngine'
import { QueryOptimizer } from './QueryOptimizer'
import { SortConfig, PaginationConfig } from './interfaces/types'

/**
 * Пример использования системы пагинации для e-commerce каталога
 */
export async function ecommerceProductPaginationExample() {
  console.log('🛍️ E-commerce Product Pagination Example')
  console.log('==========================================')

  // Создаем компоненты системы пагинации
  const paginationManager = new CursorPaginationManager()
  const sortingEngine = new SortingEngine()
  const queryOptimizer = new QueryOptimizer()

  // Запрос для поиска товаров
  const productQuery = {
    category: 'electronics',
    inStock: true,
    price: { $gte: 100, $lte: 1000 }
  }

  // Конфигурация сортировки: сначала рекомендуемые, потом по рейтингу, цене и названию
  const sortConfig: SortConfig[] = [
    { field: 'featured', direction: 'desc', type: 'boolean' },
    { field: 'rating', direction: 'desc', type: 'number' },
    { field: 'price', direction: 'asc', type: 'number' },
    { field: 'name', direction: 'asc', type: 'string' }
  ]

  // Валидация конфигурации сортировки
  if (!sortingEngine.validateSortConfig(sortConfig)) {
    throw new Error('Invalid sort configuration')
  }

  console.log('✅ Sort configuration validated')

  // Конфигурация пагинации
  const paginationConfig: PaginationConfig = {
    limit: 24, // Стандартный размер страницы для каталога
    sort: sortConfig,
    format: 'base64_json'
  }

  // Анализ производительности запроса
  const performanceAnalysis = queryOptimizer.analyzeQueryPerformance(productQuery, paginationConfig)
  console.log('📊 Performance Analysis:')
  console.log(`   Estimated Cost: ${performanceAnalysis.estimatedCost}`)
  console.log(`   Recommended Indexes: ${performanceAnalysis.recommendedIndexes.join(', ')}`)

  if (performanceAnalysis.optimizationSuggestions.length > 0) {
    console.log(`   Suggestions: ${performanceAnalysis.optimizationSuggestions.join(', ')}`)
  }

  // Оптимизация запроса
  const optimizedQuery = queryOptimizer.optimizeForPagination(
    productQuery,
    paginationConfig,
    {
      useIndexHints: true,
      maxScanDocuments: 1000
    }
  )

  console.log('⚡ Query optimized with index hints')

  // Генерация плана выполнения
  const queryPlan = queryOptimizer.generateQueryPlan(productQuery, paginationConfig)
  console.log('📋 Query Plan:')
  queryPlan.steps.forEach((step, index) => {
    console.log(`   ${index + 1}. ${step}`)
  })
  console.log(`   Estimated Time: ${queryPlan.estimatedTime}ms`)

  // Симуляция выполнения пагинации (в реальном приложении здесь был бы вызов к базе данных)
  console.log('🔄 Executing pagination...')

  // Пример результата первой страницы
  const mockFirstPageResult = {
    data: [
      { _id: 'prod1', name: 'iPhone 15', price: 999, rating: 4.8, featured: true, category: 'electronics' },
      { _id: 'prod2', name: 'MacBook Pro', price: 1299, rating: 4.9, featured: true, category: 'electronics' },
      { _id: 'prod3', name: 'iPad Air', price: 599, rating: 4.7, featured: false, category: 'electronics' }
    ],
    hasMore: true,
    nextCursor: undefined as string | undefined,
    totalCount: undefined
  }

  // Создание курсора для следующей страницы
  if (mockFirstPageResult.hasMore && mockFirstPageResult.data.length > 0) {
    const lastItem = mockFirstPageResult.data[mockFirstPageResult.data.length - 1]
    const sortValues = [
      lastItem.featured,
      lastItem.rating,
      lastItem.price,
      lastItem.name
    ]

    mockFirstPageResult.nextCursor = paginationManager.encodeCursor(
      sortValues,
      lastItem._id,
      { format: 'base64_json', includeTimestamp: true }
    )
  }

  console.log('📄 First Page Results:')
  console.log(`   Products Found: ${mockFirstPageResult.data.length}`)
  console.log(`   Has More: ${mockFirstPageResult.hasMore}`)
  console.log(`   Next Cursor: ${mockFirstPageResult.nextCursor?.substring(0, 20)}...`)

  // Пример запроса следующей страницы
  if (mockFirstPageResult.nextCursor) {
    console.log('\n🔄 Fetching next page...')

    const nextPageConfig: PaginationConfig = {
      ...paginationConfig,
      cursor: mockFirstPageResult.nextCursor
    }

    // Валидация курсора
    const isCursorValid = paginationManager.validateCursor(mockFirstPageResult.nextCursor)
    console.log(`✅ Cursor validation: ${isCursorValid ? 'Valid' : 'Invalid'}`)

    // Декодирование курсора для демонстрации
    const decodedCursor = paginationManager.decodeCursor(mockFirstPageResult.nextCursor)
    console.log('🔍 Decoded Cursor:')
    console.log(`   Sort Values: [${decodedCursor.sortValues.join(', ')}]`)
    console.log(`   Document ID: ${decodedCursor.documentId}`)
    console.log(`   Timestamp: ${new Date(decodedCursor.timestamp).toISOString()}`)
  }

  console.log('\n✅ E-commerce pagination example completed successfully!')
}

/**
 * Пример использования системы пагинации для поиска пользователей
 */
export async function userSearchPaginationExample() {
  console.log('\n👥 User Search Pagination Example')
  console.log('==================================')

  const paginationManager = new CursorPaginationManager()
  const sortingEngine = new SortingEngine()
  const queryOptimizer = new QueryOptimizer()

  // Запрос для поиска пользователей
  const userQuery = {
    department: { $in: ['engineering', 'design'] },
    level: { $gte: 'mid' },
    skills: { $all: ['javascript'] },
    active: true
  }

  // Сортировка по последней активности и имени
  const sortConfig: SortConfig[] = [
    { field: 'lastActive', direction: 'desc', type: 'date' },
    { field: 'name', direction: 'asc', type: 'string' }
  ]

  const paginationConfig: PaginationConfig = {
    limit: 50,
    sort: sortConfig,
    filters: { verified: true }, // Дополнительные фильтры
    format: 'base64_json'
  }

  // Создание компаратора для in-memory сортировки
  const comparator = sortingEngine.createSortComparator(sortConfig)
  console.log('🔧 Created sort comparator for in-memory sorting')

  // Пример данных для сортировки
  const sampleUsers = [
    { name: 'Alice', lastActive: '2023-12-01T10:00:00Z', department: 'engineering' },
    { name: 'Bob', lastActive: '2023-12-01T09:00:00Z', department: 'design' },
    { name: 'Charlie', lastActive: '2023-12-01T11:00:00Z', department: 'engineering' }
  ]

  // Сортировка данных
  const sortedUsers = sampleUsers.sort(comparator)
  console.log('📊 Sorted users:')
  sortedUsers.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.name} (${user.lastActive})`)
  })

  // Оптимизация для больших datasets
  const optimizedQuery = queryOptimizer.optimizeForPagination(
    userQuery,
    paginationConfig,
    {
      useIndexHints: true,
      maxScanDocuments: 2000,
      preferredIndexes: ['lastActive_-1', 'name_1']
    }
  )

  console.log('⚡ Query optimized for large dataset')

  // Получение подсказки по производительности
  const performanceHint = sortingEngine.getSortPerformanceHint(sortConfig)
  console.log(`💡 Performance Hint: ${performanceHint}`)

  console.log('\n✅ User search pagination example completed successfully!')
}

/**
 * Пример демонстрации различных форматов курсоров
 */
export function cursorFormatsExample() {
  console.log('\n🔗 Cursor Formats Example')
  console.log('=========================')

  const paginationManager = new CursorPaginationManager()

  // Simple ID формат
  console.log('📝 Simple ID Format:')
  const simpleIdCursor = paginationManager.encodeCursor([], 'user123', {
    format: 'simple_id'
  })
  console.log(`   Encoded: ${simpleIdCursor}`)

  const decodedSimple = paginationManager.decodeCursor(simpleIdCursor)
  console.log(`   Decoded: ${JSON.stringify(decodedSimple)}`)

  // Base64 JSON формат
  console.log('\n📝 Base64 JSON Format:')
  const base64Cursor = paginationManager.encodeCursor(
    ['Alice', 25, '2023-01-01'],
    'user123',
    {
      format: 'base64_json',
      includeTimestamp: true
    }
  )
  console.log(`   Encoded: ${base64Cursor}`)

  const decodedBase64 = paginationManager.decodeCursor(base64Cursor)
  console.log(`   Decoded: ${JSON.stringify(decodedBase64, null, 2)}`)

  // Валидация курсоров
  console.log('\n✅ Cursor Validation:')
  console.log(`   Simple ID Valid: ${paginationManager.validateCursor(simpleIdCursor)}`)
  console.log(`   Base64 JSON Valid: ${paginationManager.validateCursor(base64Cursor)}`)
  console.log(`   Invalid Cursor Valid: ${paginationManager.validateCursor('')}`)

  console.log('\n✅ Cursor formats example completed successfully!')
}

/**
 * Запуск всех примеров
 */
export async function runAllExamples() {
  console.log('🚀 Advanced Pagination System Examples')
  console.log('======================================\n')

  try {
    await ecommerceProductPaginationExample()
    await userSearchPaginationExample()
    cursorFormatsExample()

    console.log('\n🎉 All examples completed successfully!')
    console.log('The Advanced Pagination System is ready for production use.')
  } catch (error) {
    console.error('❌ Error running examples:', error)
  }
}

// Запуск примеров, если файл выполняется напрямую
if (require.main === module) {
  runAllExamples()
}