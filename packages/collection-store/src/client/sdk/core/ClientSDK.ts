/**
 * Phase 5: Client Integration - Client SDK Implementation
 *
 * Основная реализация Client SDK
 */

import { EventEmitter } from 'events'
import { IClientSDK, ICollectionManager, IFileManager, ISubscriptionManager, ICacheManager, ClientSDKConfig, SDKResult } from '../interfaces/IClientSDK'
import { ISessionManager, IConnectionManager, IStateManager } from '../../session/interfaces/ISession'
import { ICursorPaginationManager } from '../../pagination/interfaces/IPagination'
import { SessionManager } from '../../session/core/SessionManager'
import { ConnectionManager } from '../../session/connections/ConnectionManager'
import { StateManager } from '../../session/state/StateManager'
import { CursorPaginationManager } from '../../pagination/CursorPaginationManager'
import { CollectionManager } from './CollectionManager'
import { FileManager } from './FileManager'
import { SubscriptionManager } from './SubscriptionManager'
import { CacheManager } from './CacheManager'
import {
  SessionConfig,
  SessionInfo,
  ConnectionConfig,
  SDKEvent,
  SDKEventType,
  RequestStats,
  OperationMetadata
} from '../interfaces/types'

/**
 * Основная реализация Client SDK
 */
export class ClientSDK extends EventEmitter implements IClientSDK {
  // Менеджеры компонентов
  public readonly session: ISessionManager
  public readonly connection: IConnectionManager
  public readonly state: IStateManager
  public readonly pagination: ICursorPaginationManager
  public readonly collections: ICollectionManager
  public readonly files: IFileManager
  public readonly subscriptions: ISubscriptionManager
  public readonly cache: ICacheManager

  // Внутреннее состояние
  private config: ClientSDKConfig
  private currentSession: SessionInfo | null = null
  private isInitialized: boolean = false
  private requestStats: RequestStats = {
    total: 0,
    successful: 0,
    failed: 0,
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    requestsPerSecond: 0,
    errorRate: 0
  }

  constructor(config?: Partial<ClientSDKConfig>) {
    super()

    // Инициализация конфигурации по умолчанию
    this.config = {
      baseUrl: 'http://localhost:3000',
      timeout: 30000,
      retryAttempts: 3,
      session: {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      },
      connection: {
        type: 'hybrid',
        url: config?.baseUrl || 'ws://localhost:3000/ws',
        timeout: 10000,
        protocols: [],
        headers: {},
        retryConfig: {
          maxAttempts: 5,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffFactor: 2,
          jitter: true
        },
        heartbeat: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          maxMissed: 3
        }
      },
      pagination: {
        limit: 20,
        sort: [],
        format: 'base64_json'
      },
      cache: {
        enabled: true,
        maxSize: 100,
        ttl: 300000, // 5 minutes
        strategy: 'lru',
        compression: false
      },
      logging: {
        enabled: true,
        level: 'info'
      },
      ...config
    }

    // Инициализация менеджеров
    this.session = new SessionManager()
    this.connection = new ConnectionManager(process.env.NODE_ENV === 'test')
    this.state = new StateManager()
    this.pagination = new CursorPaginationManager()
    this.collections = new CollectionManager(this)
    this.files = new FileManager(this)
    this.subscriptions = new SubscriptionManager(this)
    this.cache = new CacheManager(this.config.cache!)

    // Настройка обработчиков событий
    this.setupEventHandlers()
  }

  /**
   * Инициализация SDK
   */
  async initialize(config?: ClientSDKConfig): Promise<SDKResult<SessionInfo>> {
    const startTime = performance.now()

    try {
      // Обновление конфигурации
      if (config) {
        this.config = { ...this.config, ...config }
      }

      // Создание сессии
      const sessionConfig: SessionConfig = {
        ...this.config.session!,
        userId: this.config.apiKey
      }

      this.currentSession = await this.session.createSession(sessionConfig)

      // Настройка соединения
      const connectionConfig: ConnectionConfig = {
        type: 'hybrid',
        url: this.config.baseUrl.replace('http', 'ws') + '/ws',
        timeout: 10000,
        protocols: [],
        headers: {},
        retryConfig: {
          maxAttempts: 5,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffFactor: 2,
          jitter: true
        },
        heartbeat: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          maxMissed: 3
        },
        ...this.config.connection
      }

      this.connection.setConnectionConfig(this.currentSession.sessionId, connectionConfig)

      this.isInitialized = true

      const result: SDKResult<SessionInfo> = {
        success: true,
        data: this.currentSession,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('sdk_initialized', { session: this.currentSession })
      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<SessionInfo> = {
        success: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('sdk_error', { error })
      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Подключение к серверу
   */
  async connect(): Promise<SDKResult<boolean>> {
    const startTime = performance.now()

    try {
      if (!this.isInitialized || !this.currentSession) {
        throw new Error('SDK not initialized')
      }

      await this.connection.connect(this.currentSession.sessionId)

      const result: SDKResult<boolean> = {
        success: true,
        data: true,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('sdk_connected', { sessionId: this.currentSession.sessionId })
      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<boolean> = {
        success: false,
        data: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('sdk_error', { error })
      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Отключение от сервера
   */
  async disconnect(): Promise<SDKResult<boolean>> {
    const startTime = performance.now()

    try {
      if (this.currentSession) {
        await this.connection.disconnect(this.currentSession.sessionId)
      }

      const result: SDKResult<boolean> = {
        success: true,
        data: true,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('sdk_disconnected')
      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<boolean> = {
        success: false,
        data: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('sdk_error', { error })
      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Проверка состояния подключения
   */
  isConnected(): boolean {
    if (!this.currentSession) {
      return false
    }

    return this.connection.isConnected(this.currentSession.sessionId)
  }

  /**
   * Аутентификация
   */
  async authenticate(credentials: {
    username?: string
    email?: string
    password?: string
    token?: string
  }): Promise<SDKResult<{
    token: string
    refreshToken: string
    expiresAt: Date
    user: any
  }>> {
    const startTime = performance.now()

    try {
      // Заглушка для аутентификации - в реальной реализации отправка запроса на сервер
      const authResult = {
        token: 'mock_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        user: {
          id: 'user_123',
          username: credentials.username || 'anonymous',
          email: credentials.email || 'user@example.com'
        }
      }

      const result: SDKResult<typeof authResult> = {
        success: true,
        data: authResult,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('auth_success', { user: authResult.user })
      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<any> = {
        success: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.emitSDKEvent('auth_failed', { error })
      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Выход из системы
   */
  async logout(): Promise<SDKResult<boolean>> {
    const startTime = performance.now()

    try {
      // Очистка токенов и состояния
      if (this.currentSession) {
        await this.state.clearState(this.currentSession.sessionId)
      }

      const result: SDKResult<boolean> = {
        success: true,
        data: true,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<boolean> = {
        success: false,
        data: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Получение текущего пользователя
   */
  async getCurrentUser(): Promise<SDKResult<any>> {
    const startTime = performance.now()

    try {
      // Заглушка - в реальной реализации получение из состояния или запрос к серверу
      const user = {
        id: 'user_123',
        username: 'current_user',
        email: 'user@example.com'
      }

      const result: SDKResult<any> = {
        success: true,
        data: user,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<any> = {
        success: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Получение конфигурации SDK
   */
  getConfig(): ClientSDKConfig {
    return { ...this.config }
  }

  /**
   * Обновление конфигурации SDK
   */
  async updateConfig(updates: Partial<ClientSDKConfig>): Promise<SDKResult<boolean>> {
    const startTime = performance.now()

    try {
      this.config = { ...this.config, ...updates }

      const result: SDKResult<boolean> = {
        success: true,
        data: true,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<boolean> = {
        success: false,
        data: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Получение статистики SDK
   */
  async getStats(): Promise<SDKResult<{
    session: any
    connection: any
    cache: any
    requests: RequestStats
  }>> {
    const startTime = performance.now()

    try {
      let sessionStats = null
      let connectionStats = null
      let cacheStats = null

      // Безопасное получение статистики сессии
      if (this.currentSession) {
        try {
          sessionStats = await this.session.getSessionMetrics(this.currentSession.sessionId)
        } catch (error) {
          console.warn('Failed to get session stats:', error)
        }
      }

      // Безопасное получение статистики соединения
      if (this.currentSession) {
        try {
          connectionStats = await this.connection.getConnectionStats(this.currentSession.sessionId)
        } catch (error) {
          console.warn('Failed to get connection stats:', error)
        }
      }

      // Безопасное получение статистики кэша
      try {
        cacheStats = await this.cache.getStats()
      } catch (error) {
        console.warn('Failed to get cache stats:', error)
        cacheStats = { size: 0, hits: 0, misses: 0, hitRate: 0 }
      }

      const stats = {
        session: sessionStats,
        connection: connectionStats,
        cache: cacheStats,
        requests: this.requestStats
      }

      const result: SDKResult<typeof stats> = {
        success: true,
        data: stats,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<any> = {
        success: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Завершение работы SDK
   */
  async shutdown(): Promise<SDKResult<boolean>> {
    const startTime = performance.now()

    try {
      // Отключение от сервера
      await this.disconnect()

      // Завершение работы менеджеров
      await this.session.shutdown()
      await this.cache.clear()

      // Очистка подписок
      await this.subscriptions.unsubscribeAll()

      this.isInitialized = false
      this.currentSession = null

      const result: SDKResult<boolean> = {
        success: true,
        data: true,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(true, performance.now() - startTime)

      return result

    } catch (error) {
      const result: SDKResult<boolean> = {
        success: false,
        data: false,
        error: error as Error,
        metadata: this.createOperationMetadata(startTime)
      }

      this.updateRequestStats(false, performance.now() - startTime)

      return result
    }
  }

  /**
   * Подписка на события SDK
   */
  addEventListener(event: string, callback: (data: any) => void): () => void {
    super.on(event, callback)

    return () => {
      super.removeListener(event, callback)
    }
  }

  /**
   * Отписка от событий SDK
   */
  removeEventListener(event: string, callback: (data: any) => void): void {
    super.removeListener(event, callback)
  }

  /**
   * Получение текущей сессии
   */
  getCurrentSession(): SessionInfo | null {
    return this.currentSession
  }

  /**
   * Приватные методы
   */

  private setupEventHandlers(): void {
    // Обработка событий сессии
    this.session.onSessionEvent((event) => {
      this.emitSDKEvent('session_event' as SDKEventType, event)
    })

    // Обработка событий соединения - будет добавлено при подключении
  }

  private emitSDKEvent(type: SDKEventType, data?: any): void {
    const event: SDKEvent = {
      type,
      timestamp: new Date(),
      data,
      source: 'ClientSDK'
    }

    this.emit('sdkEvent', event)
    this.emit(type, event)
  }

  private createOperationMetadata(startTime: number): OperationMetadata {
    return {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      duration: performance.now() - startTime
    }
  }

  private updateRequestStats(success: boolean, duration: number): void {
    this.requestStats.total++

    if (success) {
      this.requestStats.successful++
    } else {
      this.requestStats.failed++
    }

    // Обновление времени ответа
    this.requestStats.minResponseTime = Math.min(this.requestStats.minResponseTime, duration)
    this.requestStats.maxResponseTime = Math.max(this.requestStats.maxResponseTime, duration)

    // Расчет среднего времени ответа
    const totalTime = this.requestStats.averageResponseTime * (this.requestStats.total - 1) + duration
    this.requestStats.averageResponseTime = totalTime / this.requestStats.total

    // Расчет частоты ошибок
    this.requestStats.errorRate = this.requestStats.failed / this.requestStats.total

    // Расчет RPS (упрощенный)
    this.requestStats.requestsPerSecond = this.requestStats.total / (Date.now() / 1000)
  }
}