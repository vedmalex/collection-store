/**
 * Phase 5: Client Integration - Client SDK Interfaces
 *
 * Основные интерфейсы для Client SDK
 */

import { ISessionManager, IConnectionManager, IStateManager } from '../../session/interfaces/ISession'
import { ICursorPaginationManager } from '../../pagination/interfaces/IPagination'
import {
  SessionConfig,
  SessionInfo,
  ClientState,
  ConnectionConfig,
  PaginationConfig,
  PaginatedResult,
  QueryOptions,
  SortOptions,
  FilterOptions,
  CacheConfig
} from './types'

/**
 * Конфигурация Client SDK
 */
export interface ClientSDKConfig {
  // Базовые настройки
  baseUrl: string
  apiKey?: string
  timeout?: number
  retryAttempts?: number

  // Настройки сессии
  session?: Partial<SessionConfig>

  // Настройки соединения
  connection?: Partial<ConnectionConfig>

  // Настройки пагинации
  pagination?: Partial<PaginationConfig>

  // Настройки кэширования
  cache?: Partial<CacheConfig>

  // Настройки логирования
  logging?: {
    enabled: boolean
    level: 'debug' | 'info' | 'warn' | 'error'
  }
}

/**
 * Результат операции SDK
 */
export interface SDKResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  metadata?: {
    requestId: string
    timestamp: Date
    duration: number
  }
}

/**
 * Опции для операций SDK
 */
export interface SDKOperationOptions {
  timeout?: number
  retries?: number
  cache?: boolean
  priority?: 'low' | 'normal' | 'high'
}

/**
 * Интерфейс для управления коллекциями
 */
export interface ICollectionManager {
  /**
   * Получение документов из коллекции
   */
  find<T = any>(
    collection: string,
    query?: QueryOptions,
    options?: SDKOperationOptions
  ): Promise<SDKResult<T[]>>

  /**
   * Получение документов с пагинацией
   */
  findWithPagination<T = any>(
    collection: string,
    query?: QueryOptions,
    pagination?: PaginationConfig,
    options?: SDKOperationOptions
  ): Promise<SDKResult<PaginatedResult<T>>>

  /**
   * Получение одного документа
   */
  findOne<T = any>(
    collection: string,
    query?: QueryOptions,
    options?: SDKOperationOptions
  ): Promise<SDKResult<T | null>>

  /**
   * Создание документа
   */
  create<T = any>(
    collection: string,
    data: Partial<T>,
    options?: SDKOperationOptions
  ): Promise<SDKResult<T>>

  /**
   * Обновление документа
   */
  update<T = any>(
    collection: string,
    id: string,
    data: Partial<T>,
    options?: SDKOperationOptions
  ): Promise<SDKResult<T>>

  /**
   * Удаление документа
   */
  delete(
    collection: string,
    id: string,
    options?: SDKOperationOptions
  ): Promise<SDKResult<boolean>>

  /**
   * Подсчет документов
   */
  count(
    collection: string,
    query?: QueryOptions,
    options?: SDKOperationOptions
  ): Promise<SDKResult<number>>
}

/**
 * Интерфейс для управления файлами
 */
export interface IFileManager {
  /**
   * Загрузка файла
   */
  upload(
    file: File | Buffer,
    options?: {
      collection?: string
      metadata?: Record<string, any>
      compression?: boolean
      encryption?: boolean
    } & SDKOperationOptions
  ): Promise<SDKResult<{ fileId: string; url: string }>>

  /**
   * Скачивание файла
   */
  download(
    fileId: string,
    options?: SDKOperationOptions
  ): Promise<SDKResult<Blob | Buffer>>

  /**
   * Получение информации о файле
   */
  getFileInfo(
    fileId: string,
    options?: SDKOperationOptions
  ): Promise<SDKResult<{
    fileId: string
    filename: string
    size: number
    mimeType: string
    uploadedAt: Date
    metadata: Record<string, any>
  }>>

  /**
   * Удаление файла
   */
  deleteFile(
    fileId: string,
    options?: SDKOperationOptions
  ): Promise<SDKResult<boolean>>

  /**
   * Получение списка файлов
   */
  listFiles(
    options?: {
      collection?: string
      limit?: number
      offset?: number
    } & SDKOperationOptions
  ): Promise<SDKResult<any[]>>
}

/**
 * Интерфейс для управления подписками
 */
export interface ISubscriptionManager {
  /**
   * Подписка на изменения в коллекции
   */
  subscribe<T = any>(
    collection: string,
    query?: QueryOptions,
    callback?: (event: {
      type: 'insert' | 'update' | 'delete'
      data: T
      timestamp: Date
    }) => void
  ): Promise<SDKResult<{ subscriptionId: string; unsubscribe: () => void }>>

  /**
   * Отписка от изменений
   */
  unsubscribe(subscriptionId: string): Promise<SDKResult<boolean>>

  /**
   * Получение активных подписок
   */
  getActiveSubscriptions(): Promise<SDKResult<string[]>>

  /**
   * Отписка от всех подписок
   */
  unsubscribeAll(): Promise<SDKResult<boolean>>
}

/**
 * Интерфейс для управления кэшем
 */
export interface ICacheManager {
  /**
   * Получение данных из кэша
   */
  get<T = any>(key: string): Promise<T | null>

  /**
   * Сохранение данных в кэш
   */
  set<T = any>(key: string, value: T, ttl?: number): Promise<void>

  /**
   * Удаление данных из кэша
   */
  delete(key: string): Promise<boolean>

  /**
   * Очистка кэша
   */
  clear(): Promise<void>

  /**
   * Получение статистики кэша
   */
  getStats(): Promise<{
    size: number
    hits: number
    misses: number
    hitRate: number
  }>
}

/**
 * Главный интерфейс Client SDK
 */
export interface IClientSDK {
  /**
   * Менеджер сессий
   */
  readonly session: ISessionManager

  /**
   * Менеджер соединений
   */
  readonly connection: IConnectionManager

  /**
   * Менеджер состояния
   */
  readonly state: IStateManager

  /**
   * Менеджер пагинации
   */
  readonly pagination: ICursorPaginationManager

  /**
   * Менеджер коллекций
   */
  readonly collections: ICollectionManager

  /**
   * Менеджер файлов
   */
  readonly files: IFileManager

  /**
   * Менеджер подписок
   */
  readonly subscriptions: ISubscriptionManager

  /**
   * Менеджер кэша
   */
  readonly cache: ICacheManager

  /**
   * Инициализация SDK
   */
  initialize(config: ClientSDKConfig): Promise<SDKResult<SessionInfo>>

  /**
   * Подключение к серверу
   */
  connect(): Promise<SDKResult<boolean>>

  /**
   * Отключение от сервера
   */
  disconnect(): Promise<SDKResult<boolean>>

  /**
   * Проверка состояния подключения
   */
  isConnected(): boolean

  /**
   * Аутентификация
   */
  authenticate(credentials: {
    username?: string
    email?: string
    password?: string
    token?: string
  }): Promise<SDKResult<{
    token: string
    refreshToken: string
    expiresAt: Date
    user: any
  }>>

  /**
   * Выход из системы
   */
  logout(): Promise<SDKResult<boolean>>

  /**
   * Получение текущего пользователя
   */
  getCurrentUser(): Promise<SDKResult<any>>

  /**
   * Получение конфигурации SDK
   */
  getConfig(): ClientSDKConfig

  /**
   * Обновление конфигурации SDK
   */
  updateConfig(updates: Partial<ClientSDKConfig>): Promise<SDKResult<boolean>>

  /**
   * Получение статистики SDK
   */
  getStats(): Promise<SDKResult<{
    session: any
    connection: any
    cache: any
    requests: {
      total: number
      successful: number
      failed: number
      averageResponseTime: number
    }
  }>>

  /**
   * Завершение работы SDK
   */
  shutdown(): Promise<SDKResult<boolean>>

  /**
   * Подписка на события SDK
   */
  addEventListener(event: string, callback: (data: any) => void): () => void

  /**
   * Отписка от событий SDK
   */
  removeEventListener(event: string, callback: (data: any) => void): void
}