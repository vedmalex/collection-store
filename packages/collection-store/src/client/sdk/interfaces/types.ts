/**
 * Phase 5: Client Integration - SDK Types
 *
 * Типы для Client SDK
 */

// Re-export types from session system
export {
  SessionConfig,
  SessionInfo,
  ClientState,
  ConnectionConfig,
  ConnectionType,
  ConnectionState,
  SessionState,
  SessionEvent,
  SessionEventType,
  SessionMetrics,
  SessionAuthOptions,
  SessionAuthResult,
  SessionRecoveryOptions,
  SessionRecoveryResult,
  StateSyncOptions,
  StateSyncResult,
  SessionContext,
  RetryConfig,
  HeartbeatConfig
} from '../../session/interfaces/types'

// Re-export types from pagination system
export {
  PaginationConfig,
  PaginatedResult,
  SortDirection,
  CursorFormat,
  SortConfig,
  CursorInfo,
  QueryOptimizationOptions,
  PaginationPerformanceStats,
  PaginatedResultWithStats,
  CursorCreationOptions,
  PaginationContext
} from '../../pagination/interfaces/types'

/**
 * Опции запроса для коллекций
 */
export interface QueryOptions {
  // Фильтры
  filter?: FilterOptions

  // Сортировка
  sort?: SortOptions

  // Проекция полей
  select?: string[]

  // Лимит результатов
  limit?: number

  // Смещение
  offset?: number

  // Включение связанных данных
  populate?: string[]

  // Кэширование
  cache?: boolean

  // Таймаут запроса
  timeout?: number
}

/**
 * Опции фильтрации
 */
export interface FilterOptions {
  [field: string]: any | {
    $eq?: any
    $ne?: any
    $gt?: any
    $gte?: any
    $lt?: any
    $lte?: any
    $in?: any[]
    $nin?: any[]
    $regex?: string
    $exists?: boolean
    $type?: string
    $and?: FilterOptions[]
    $or?: FilterOptions[]
    $not?: FilterOptions
  }
}

/**
 * Опции сортировки
 */
export interface SortOptions {
  [field: string]: 'asc' | 'desc' | 1 | -1
}

/**
 * Конфигурация кэша
 */
export interface CacheConfig {
  enabled: boolean
  maxSize: number
  ttl: number
  strategy: 'lru' | 'lfu' | 'fifo'
  compression: boolean
}

/**
 * Конфигурация логирования
 */
export interface LoggingConfig {
  enabled: boolean
  level: 'debug' | 'info' | 'warn' | 'error'
  destination: 'console' | 'file' | 'remote'
  format: 'json' | 'text'
}

/**
 * Статистика запросов
 */
export interface RequestStats {
  total: number
  successful: number
  failed: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  errorRate: number
}

/**
 * Метаданные операции
 */
export interface OperationMetadata {
  requestId: string
  timestamp: Date
  duration: number
  retryCount?: number
  cacheHit?: boolean
  source?: 'cache' | 'network' | 'local'
}

/**
 * Событие SDK
 */
export interface SDKEvent {
  type: SDKEventType
  timestamp: Date
  data?: any
  source: string
}

/**
 * Типы событий SDK
 */
export type SDKEventType =
  | 'sdk_initialized'
  | 'sdk_connected'
  | 'sdk_disconnected'
  | 'sdk_error'
  | 'auth_success'
  | 'auth_failed'
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'cache_hit'
  | 'cache_miss'
  | 'subscription_created'
  | 'subscription_data'
  | 'subscription_error'
  | 'file_uploaded'
  | 'file_downloaded'

/**
 * Конфигурация файлового менеджера
 */
export interface FileManagerConfig {
  maxFileSize: number
  allowedMimeTypes: string[]
  compression: boolean
  encryption: boolean
  thumbnails: boolean
  chunkSize: number
}

/**
 * Информация о файле
 */
export interface FileInfo {
  fileId: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  uploadedAt: Date
  metadata: Record<string, any>
  url?: string
  thumbnailUrl?: string
  checksum: string
}

/**
 * Опции загрузки файла
 */
export interface FileUploadOptions {
  collection?: string
  metadata?: Record<string, any>
  compression?: boolean
  encryption?: boolean
  generateThumbnail?: boolean
  onProgress?: (progress: number) => void
}

/**
 * Конфигурация подписок
 */
export interface SubscriptionConfig {
  autoReconnect: boolean
  maxReconnectAttempts: number
  reconnectInterval: number
  heartbeatInterval: number
  bufferSize: number
}

/**
 * Событие подписки
 */
export interface SubscriptionEvent<T = any> {
  type: 'insert' | 'update' | 'delete' | 'error'
  collection: string
  data?: T
  oldData?: T
  timestamp: Date
  subscriptionId: string
}

/**
 * Информация о подписке
 */
export interface SubscriptionInfo {
  subscriptionId: string
  collection: string
  query: QueryOptions
  createdAt: Date
  lastEventAt?: Date
  eventCount: number
  isActive: boolean
}

/**
 * Конфигурация offline-режима
 */
export interface OfflineConfig {
  enabled: boolean
  syncInterval: number
  maxQueueSize: number
  conflictResolution: 'client' | 'server' | 'manual'
  persistentStorage: boolean
}

/**
 * Операция в offline-режиме
 */
export interface OfflineOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  collection: string
  data: any
  timestamp: Date
  retryCount: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
}

/**
 * Результат синхронизации offline-операций
 */
export interface OfflineSyncResult {
  success: boolean
  syncedOperations: number
  failedOperations: number
  conflicts: number
  errors: Error[]
}

/**
 * Конфигурация производительности
 */
export interface PerformanceConfig {
  requestTimeout: number
  maxConcurrentRequests: number
  retryAttempts: number
  retryDelay: number
  batchSize: number
  debounceInterval: number
}

/**
 * Метрики производительности
 */
export interface PerformanceMetrics {
  requests: RequestStats
  cache: {
    size: number
    hits: number
    misses: number
    hitRate: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  network: {
    latency: number
    bandwidth: number
    packetsLost: number
  }
}