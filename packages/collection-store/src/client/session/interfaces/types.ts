/**
 * Phase 5: Client Integration - Session Management Types
 *
 * Типы для управления клиентскими сессиями, соединениями и состоянием
 */

/**
 * Тип соединения
 */
export type ConnectionType = 'websocket' | 'http' | 'hybrid'

/**
 * Состояние соединения
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

/**
 * Состояние сессии
 */
export type SessionState = 'initializing' | 'active' | 'suspended' | 'expired' | 'terminated'

/**
 * Тип события сессии
 */
export type SessionEventType =
  | 'session_created'
  | 'session_updated'
  | 'session_expired'
  | 'session_terminated'
  | 'connection_established'
  | 'connection_lost'
  | 'connection_restored'
  | 'auth_required'
  | 'auth_success'
  | 'auth_failed'
  | 'state_synchronized'
  | 'error_occurred'

/**
 * Конфигурация сессии
 */
export interface SessionConfig {
  sessionId?: string
  userId?: string
  connectionType: ConnectionType
  autoReconnect: boolean
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval: number
  sessionTimeout: number
  persistState: boolean
  encryptState: boolean
}

/**
 * Информация о сессии
 */
export interface SessionInfo {
  sessionId: string
  userId?: string
  state: SessionState
  createdAt: Date
  lastActiveAt: Date
  expiresAt: Date
  connectionState: ConnectionState
  metadata: Record<string, any>
}

/**
 * Конфигурация соединения
 */
export interface ConnectionConfig {
  type: ConnectionType
  url: string
  protocols?: string[]
  headers?: Record<string, string>
  timeout: number
  retryConfig: RetryConfig
  heartbeat: HeartbeatConfig
}

/**
 * Конфигурация повторных попыток
 */
export interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffFactor: number
  jitter: boolean
}

/**
 * Конфигурация heartbeat
 */
export interface HeartbeatConfig {
  enabled: boolean
  interval: number
  timeout: number
  maxMissed: number
}

/**
 * Событие сессии
 */
export interface SessionEvent {
  type: SessionEventType
  sessionId: string
  timestamp: Date
  data?: any
  error?: Error
}

/**
 * Состояние клиента
 */
export interface ClientState {
  sessionInfo: SessionInfo
  connectionInfo: ConnectionInfo
  userData: Record<string, any>
  preferences: Record<string, any>
  cache: Record<string, any>
  subscriptions: string[]
  lastSyncAt: Date
}

/**
 * Информация о соединении
 */
export interface ConnectionInfo {
  type: ConnectionType
  state: ConnectionState
  url: string
  connectedAt?: Date
  lastHeartbeatAt?: Date
  reconnectAttempts: number
  latency?: number
  bandwidth?: number
}

/**
 * Опции синхронизации состояния
 */
export interface StateSyncOptions {
  immediate: boolean
  includeCache: boolean
  includePreferences: boolean
  includeSubscriptions: boolean
  compression: boolean
  encryption: boolean
}

/**
 * Результат синхронизации состояния
 */
export interface StateSyncResult {
  success: boolean
  syncedAt: Date
  conflictsResolved: number
  dataSize: number
  compressionRatio?: number
  error?: Error
}

/**
 * Опции восстановления сессии
 */
export interface SessionRecoveryOptions {
  restoreState: boolean
  restoreSubscriptions: boolean
  restoreCache: boolean
  validateSession: boolean
  maxAge: number
}

/**
 * Результат восстановления сессии
 */
export interface SessionRecoveryResult {
  success: boolean
  sessionRestored: boolean
  stateRestored: boolean
  subscriptionsRestored: number
  cacheRestored: boolean
  warnings: string[]
  error?: Error
}

/**
 * Метрики производительности сессии
 */
export interface SessionMetrics {
  sessionDuration: number
  connectionUptime: number
  reconnectCount: number
  averageLatency: number
  dataTransferred: number
  errorsCount: number
  lastErrorAt?: Date
}

/**
 * Опции аутентификации сессии
 */
export interface SessionAuthOptions {
  token?: string
  refreshToken?: string
  autoRefresh: boolean
  validateOnConnect: boolean
  requireAuth: boolean
}

/**
 * Результат аутентификации сессии
 */
export interface SessionAuthResult {
  success: boolean
  token?: string
  refreshToken?: string
  expiresAt?: Date
  permissions: string[]
  error?: Error
}

/**
 * Контекст сессии
 */
export interface SessionContext {
  sessionId: string
  userId?: string
  permissions: string[]
  metadata: Record<string, any>
  startTime: Date
  lastActivity: Date
}