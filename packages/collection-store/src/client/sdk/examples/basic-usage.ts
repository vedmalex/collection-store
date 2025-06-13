/**
 * Phase 5: Client Integration - Basic SDK Usage Examples
 *
 * Примеры базового использования Client SDK
 */

import { ClientSDK, ClientSDKConfig } from '../index'

/**
 * Пример 1: Базовая инициализация и подключение
 */
export async function basicInitialization() {
  console.log('=== Пример 1: Базовая инициализация ===')

  // Создание SDK с базовой конфигурацией
  const sdk = new ClientSDK({
    baseUrl: 'http://localhost:3000',
    apiKey: 'your-api-key',
    timeout: 30000,
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 300000 // 5 минут
    },
    logging: {
      enabled: true,
      level: 'info'
    }
  })

  try {
    // Инициализация SDK
    const initResult = await sdk.initialize()
    console.log('SDK инициализирован:', initResult.success)
    console.log('Session ID:', initResult.data?.sessionId)

    // Подключение к серверу
    const connectResult = await sdk.connect()
    console.log('Подключение:', connectResult.success)
    console.log('Статус подключения:', sdk.isConnected())

    // Получение статистики
    const stats = await sdk.getStats()
    console.log('Статистика SDK:', stats.data)

    return sdk
  } catch (error) {
    console.error('Ошибка инициализации:', error)
    throw error
  }
}

/**
 * Пример 2: Аутентификация пользователя
 */
export async function userAuthentication() {
  console.log('=== Пример 2: Аутентификация ===')

  const sdk = await basicInitialization()

  try {
    // Аутентификация с username/password
    const authResult = await sdk.authenticate({
      username: 'demo_user',
      password: 'demo_password'
    })

    if (authResult.success) {
      console.log('Аутентификация успешна')
      console.log('Токен:', authResult.data?.token)
      console.log('Пользователь:', authResult.data?.user)

      // Получение текущего пользователя
      const userResult = await sdk.getCurrentUser()
      console.log('Текущий пользователь:', userResult.data)
    } else {
      console.error('Ошибка аутентификации:', authResult.error)
    }

    return sdk
  } catch (error) {
    console.error('Ошибка аутентификации:', error)
    throw error
  }
}

/**
 * Пример 3: Работа с коллекциями
 */
export async function collectionOperations() {
  console.log('=== Пример 3: Операции с коллекциями ===')

  const sdk = await userAuthentication()

  try {
    // Создание документа
    const createResult = await sdk.collections.create('users', {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    })
    console.log('Создан документ:', createResult.data)

    // Поиск документов
    const findResult = await sdk.collections.find('users', {
      filter: { age: { $gte: 18 } },
      limit: 10,
      sort: { name: 'asc' }
    })
    console.log('Найдено документов:', findResult.data?.length)

    // Поиск с пагинацией
    const paginatedResult = await sdk.collections.findWithPagination('users',
      {
        filter: { age: { $gte: 18 } }
      },
      {
        limit: 5,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
    )
    console.log('Пагинированный результат:', {
      count: paginatedResult.data?.data.length,
      hasMore: paginatedResult.data?.hasMore,
      nextCursor: paginatedResult.data?.nextCursor
    })

    // Обновление документа
    if (createResult.data && 'id' in createResult.data) {
      const updateResult = await sdk.collections.update('users', (createResult.data as any).id, {
        age: 31
      })
      console.log('Обновлен документ:', updateResult.data)
    }

    // Подсчет документов
    const countResult = await sdk.collections.count('users', {
      filter: { age: { $gte: 18 } }
    })
    console.log('Количество документов:', countResult.data)

    return sdk
  } catch (error) {
    console.error('Ошибка операций с коллекциями:', error)
    throw error
  }
}

/**
 * Пример 4: Работа с файлами
 */
export async function fileOperations() {
  console.log('=== Пример 4: Операции с файлами ===')

  const sdk = await userAuthentication()

  try {
    // Создание тестового файла
    const fileContent = 'Это тестовый файл для демонстрации SDK'
    const file = new Blob([fileContent], { type: 'text/plain' })

    // Загрузка файла
    const uploadResult = await sdk.files.upload(file as any, {
      collection: 'documents',
      metadata: {
        description: 'Тестовый документ',
        tags: ['demo', 'sdk']
      },
      compression: true
    })
    console.log('Файл загружен:', uploadResult.data)

    if (uploadResult.data?.fileId) {
      // Получение информации о файле
      const fileInfo = await sdk.files.getFileInfo(uploadResult.data.fileId)
      console.log('Информация о файле:', fileInfo.data)

      // Скачивание файла
      const downloadResult = await sdk.files.download(uploadResult.data.fileId)
      const fileSize = downloadResult.data instanceof Blob ? downloadResult.data.size : 'unknown'
      console.log('Файл скачан, размер:', fileSize)

      // Список файлов
      const listResult = await sdk.files.listFiles({
        collection: 'documents',
        limit: 10
      })
      console.log('Список файлов:', listResult.data?.length)
    }

    return sdk
  } catch (error) {
    console.error('Ошибка операций с файлами:', error)
    throw error
  }
}

/**
 * Пример 5: Real-time подписки
 */
export async function realtimeSubscriptions() {
  console.log('=== Пример 5: Real-time подписки ===')

  const sdk = await userAuthentication()

  try {
    // Подписка на изменения в коллекции
    const subscriptionResult = await sdk.subscriptions.subscribe(
      'users',
      {
        filter: { age: { $gte: 18 } }
      },
      (event) => {
        console.log('Получено событие:', {
          type: event.type,
          data: event.data,
          timestamp: event.timestamp
        })
      }
    )

    if (subscriptionResult.success) {
      console.log('Подписка создана:', subscriptionResult.data?.subscriptionId)

      // Получение активных подписок
      const activeSubscriptions = await sdk.subscriptions.getActiveSubscriptions()
      console.log('Активные подписки:', activeSubscriptions.data)

      // Симуляция работы с подпиской в течение 10 секунд
      await new Promise(resolve => setTimeout(resolve, 10000))

      // Отписка
      if (subscriptionResult.data?.unsubscribe) {
        subscriptionResult.data.unsubscribe()
        console.log('Отписка выполнена')
      }
    }

    return sdk
  } catch (error) {
    console.error('Ошибка подписок:', error)
    throw error
  }
}

/**
 * Пример 6: Работа с кэшем
 */
export async function cacheOperations() {
  console.log('=== Пример 6: Операции с кэшем ===')

  const sdk = await userAuthentication()

  try {
    // Сохранение данных в кэш
    await sdk.cache.set('user_preferences', {
      theme: 'dark',
      language: 'ru',
      notifications: true
    }, 60000) // TTL 1 минута

    // Получение данных из кэша
    const cachedData = await sdk.cache.get('user_preferences')
    console.log('Данные из кэша:', cachedData)

    // Статистика кэша
    const cacheStats = await sdk.cache.getStats()
    console.log('Статистика кэша:', cacheStats)

    // Очистка конкретного ключа
    await sdk.cache.delete('user_preferences')
    console.log('Ключ удален из кэша')

    return sdk
  } catch (error) {
    console.error('Ошибка операций с кэшем:', error)
    throw error
  }
}

/**
 * Пример 7: Обработка событий SDK
 */
export async function eventHandling() {
  console.log('=== Пример 7: Обработка событий ===')

  const sdk = new ClientSDK({
    baseUrl: 'http://localhost:3000',
    logging: { enabled: true, level: 'debug' }
  })

  // Подписка на события SDK
  const unsubscribeInit = sdk.addEventListener('sdk_initialized', (event) => {
    console.log('SDK инициализирован:', event.timestamp)
  })

  const unsubscribeConnect = sdk.addEventListener('sdk_connected', (event) => {
    console.log('SDK подключен:', event.data)
  })

  const unsubscribeAuth = sdk.addEventListener('auth_success', (event) => {
    console.log('Аутентификация успешна:', event.data.user)
  })

  const unsubscribeError = sdk.addEventListener('sdk_error', (event) => {
    console.error('Ошибка SDK:', event.data.error)
  })

  try {
    await sdk.initialize()
    await sdk.connect()
    await sdk.authenticate({ username: 'demo', password: 'demo' })

    // Отписка от событий
    unsubscribeInit()
    unsubscribeConnect()
    unsubscribeAuth()
    unsubscribeError()

    return sdk
  } catch (error) {
    console.error('Ошибка обработки событий:', error)
    throw error
  }
}

/**
 * Пример 8: Полный жизненный цикл приложения
 */
export async function fullApplicationLifecycle() {
  console.log('=== Пример 8: Полный жизненный цикл ===')

  let sdk: ClientSDK | null = null

  try {
    // 1. Инициализация
    sdk = await basicInitialization()

    // 2. Аутентификация
    await sdk.authenticate({ username: 'demo', password: 'demo' })

    // 3. Работа с данными
    await sdk.collections.create('tasks', {
      title: 'Изучить Collection Store SDK',
      completed: false,
      priority: 'high'
    })

    // 4. Подписка на обновления
    const subscription = await sdk.subscriptions.subscribe('tasks', {}, (event) => {
      console.log('Задача обновлена:', event.type, event.data)
    })

    // 5. Кэширование часто используемых данных
    await sdk.cache.set('app_config', {
      version: '1.0.0',
      features: ['pagination', 'realtime', 'files']
    })

    // 6. Мониторинг производительности
    const stats = await sdk.getStats()
    console.log('Финальная статистика:', {
      requests: stats.data?.requests.total,
      errors: stats.data?.requests.failed,
      cacheHitRate: stats.data?.cache.hitRate
    })

    console.log('Жизненный цикл приложения завершен успешно')

  } catch (error) {
    console.error('Ошибка в жизненном цикле:', error)
  } finally {
    // 7. Корректное завершение работы
    if (sdk) {
      await sdk.shutdown()
      console.log('SDK корректно завершил работу')
    }
  }
}

/**
 * Запуск всех примеров
 */
export async function runAllExamples() {
  console.log('🚀 Запуск примеров использования Collection Store SDK\n')

  try {
    await basicInitialization()
    console.log('\n' + '='.repeat(50) + '\n')

    await userAuthentication()
    console.log('\n' + '='.repeat(50) + '\n')

    await collectionOperations()
    console.log('\n' + '='.repeat(50) + '\n')

    await fileOperations()
    console.log('\n' + '='.repeat(50) + '\n')

    await realtimeSubscriptions()
    console.log('\n' + '='.repeat(50) + '\n')

    await cacheOperations()
    console.log('\n' + '='.repeat(50) + '\n')

    await eventHandling()
    console.log('\n' + '='.repeat(50) + '\n')

    await fullApplicationLifecycle()

    console.log('\n✅ Все примеры выполнены успешно!')

  } catch (error) {
    console.error('\n❌ Ошибка выполнения примеров:', error)
  }
}

// Экспорт для использования в других модулях
export default {
  basicInitialization,
  userAuthentication,
  collectionOperations,
  fileOperations,
  realtimeSubscriptions,
  cacheOperations,
  eventHandling,
  fullApplicationLifecycle,
  runAllExamples
}