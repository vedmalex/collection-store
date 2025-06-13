/**
 * Phase 5: Client Integration - Session Management Interfaces
 *
 * Интерфейсы для управления клиентскими сессиями
 */

import {
  SessionConfig,
  SessionInfo,
  SessionEvent,
  SessionState,
  SessionEventType,
  ClientState,
  SessionMetrics,
  SessionAuthOptions,
  SessionAuthResult,
  SessionRecoveryOptions,
  SessionRecoveryResult,
  StateSyncOptions,
  StateSyncResult,
  SessionContext
} from './types'

/**
 * Основной интерфейс для управления сессиями
 */
export interface ISessionManager {
  /**
   * Создание новой сессии
   */
  createSession(config: SessionConfig): Promise<SessionInfo>

  /**
   * Получение информации о сессии
   */
  getSession(sessionId: string): Promise<SessionInfo | null>

  /**
   * Обновление сессии
   */
  updateSession(sessionId: string, updates: Partial<SessionInfo>): Promise<SessionInfo>

  /**
   * Завершение сессии
   */
  terminateSession(sessionId: string): Promise<void>

  /**
   * Восстановление сессии
   */
  recoverSession(sessionId: string, options: SessionRecoveryOptions): Promise<SessionRecoveryResult>

  /**
   * Получение активных сессий
   */
  getActiveSessions(): Promise<SessionInfo[]>

  /**
   * Очистка истекших сессий
   */
  cleanupExpiredSessions(): Promise<number>

  /**
   * Получение метрик сессии
   */
  getSessionMetrics(sessionId: string): Promise<SessionMetrics>

  /**
   * Подписка на события сессии
   */
  onSessionEvent(callback: (event: SessionEvent) => void): () => void

  /**
   * Валидация сессии
   */
  validateSession(sessionId: string): Promise<boolean>

  /**
   * Завершение работы менеджера сессий
   */
  shutdown(): Promise<void>
}

/**
 * Интерфейс для управления соединениями
 */
export interface IConnectionManager {
  /**
   * Установка соединения
   */
  connect(sessionId: string): Promise<void>

  /**
   * Закрытие соединения
   */
  disconnect(sessionId: string): Promise<void>

  /**
   * Переподключение
   */
  reconnect(sessionId: string): Promise<void>

  /**
   * Проверка состояния соединения
   */
  isConnected(sessionId: string): boolean

  /**
   * Отправка данных
   */
  send(sessionId: string, data: any): Promise<void>

  /**
   * Подписка на сообщения
   */
  onMessage(sessionId: string, callback: (data: any) => void): () => void

  /**
   * Подписка на события соединения
   */
  onConnectionEvent(sessionId: string, callback: (event: SessionEvent) => void): () => void

  /**
   * Получение статистики соединения
   */
  getConnectionStats(sessionId: string): Promise<any>

  /**
   * Настройка heartbeat
   */
  setupHeartbeat(sessionId: string): void

  /**
   * Остановка heartbeat
   */
  stopHeartbeat(sessionId: string): void

  /**
   * Настройка конфигурации соединения
   */
  setConnectionConfig(sessionId: string, config: any): void

  /**
   * Получение конфигурации соединения
   */
  getConnectionConfig(sessionId: string): any
}

/**
 * Интерфейс для управления состоянием клиента
 */
export interface IStateManager {
  /**
   * Получение состояния клиента
   */
  getState(sessionId: string): Promise<ClientState | null>

  /**
   * Обновление состояния клиента
   */
  updateState(sessionId: string, updates: Partial<ClientState>): Promise<void>

  /**
   * Синхронизация состояния
   */
  syncState(sessionId: string, options: StateSyncOptions): Promise<StateSyncResult>

  /**
   * Сохранение состояния
   */
  persistState(sessionId: string): Promise<void>

  /**
   * Восстановление состояния
   */
  restoreState(sessionId: string): Promise<ClientState | null>

  /**
   * Очистка состояния
   */
  clearState(sessionId: string): Promise<void>

  /**
   * Подписка на изменения состояния
   */
  onStateChange(sessionId: string, callback: (state: ClientState) => void): () => void

  /**
   * Получение размера состояния
   */
  getStateSize(sessionId: string): Promise<number>

  /**
   * Сжатие состояния
   */
  compressState(sessionId: string): Promise<void>
}

/**
 * Интерфейс для аутентификации сессий
 */
export interface ISessionAuth {
  /**
   * Аутентификация сессии
   */
  authenticate(sessionId: string, options: SessionAuthOptions): Promise<SessionAuthResult>

  /**
   * Обновление токена
   */
  refreshToken(sessionId: string): Promise<SessionAuthResult>

  /**
   * Проверка токена
   */
  validateToken(sessionId: string): Promise<boolean>

  /**
   * Получение разрешений
   */
  getPermissions(sessionId: string): Promise<string[]>

  /**
   * Проверка разрешения
   */
  hasPermission(sessionId: string, permission: string): Promise<boolean>

  /**
   * Выход из системы
   */
  logout(sessionId: string): Promise<void>

  /**
   * Получение контекста сессии
   */
  getSessionContext(sessionId: string): Promise<SessionContext | null>
}

/**
 * Интерфейс для восстановления сессий
 */
export interface ISessionRecovery {
  /**
   * Восстановление сессии после сбоя
   */
  recoverFromFailure(sessionId: string): Promise<SessionRecoveryResult>

  /**
   * Восстановление соединения
   */
  recoverConnection(sessionId: string): Promise<boolean>

  /**
   * Восстановление состояния
   */
  recoverState(sessionId: string): Promise<boolean>

  /**
   * Восстановление подписок
   */
  recoverSubscriptions(sessionId: string): Promise<number>

  /**
   * Проверка возможности восстановления
   */
  canRecover(sessionId: string): Promise<boolean>

  /**
   * Получение стратегии восстановления
   */
  getRecoveryStrategy(sessionId: string): Promise<string>

  /**
   * Настройка автоматического восстановления
   */
  setupAutoRecovery(sessionId: string): void

  /**
   * Отключение автоматического восстановления
   */
  disableAutoRecovery(sessionId: string): void
}

/**
 * Интерфейс для мониторинга сессий
 */
export interface ISessionMonitor {
  /**
   * Запуск мониторинга
   */
  startMonitoring(sessionId: string): void

  /**
   * Остановка мониторинга
   */
  stopMonitoring(sessionId: string): void

  /**
   * Получение метрик в реальном времени
   */
  getRealTimeMetrics(sessionId: string): Promise<SessionMetrics>

  /**
   * Получение истории метрик
   */
  getMetricsHistory(sessionId: string, timeRange: { from: Date; to: Date }): Promise<SessionMetrics[]>

  /**
   * Настройка алертов
   */
  setupAlerts(sessionId: string, thresholds: Record<string, number>): void

  /**
   * Подписка на алерты
   */
  onAlert(callback: (alert: { sessionId: string; metric: string; value: number; threshold: number }) => void): () => void

  /**
   * Проверка здоровья сессии
   */
  checkHealth(sessionId: string): Promise<{ healthy: boolean; issues: string[] }>

  /**
   * Генерация отчета о производительности
   */
  generatePerformanceReport(sessionId: string): Promise<any>
}

/**
 * Главный интерфейс клиентской сессии
 */
export interface IClientSession {
  /**
   * Менеджер сессий
   */
  readonly sessionManager: ISessionManager

  /**
   * Менеджер соединений
   */
  readonly connectionManager: IConnectionManager

  /**
   * Менеджер состояния
   */
  readonly stateManager: IStateManager

  /**
   * Аутентификация
   */
  readonly auth: ISessionAuth

  /**
   * Восстановление
   */
  readonly recovery: ISessionRecovery

  /**
   * Мониторинг
   */
  readonly monitor: ISessionMonitor

  /**
   * Инициализация клиентской сессии
   */
  initialize(config: SessionConfig): Promise<SessionInfo>

  /**
   * Завершение работы
   */
  shutdown(): Promise<void>

  /**
   * Получение текущей сессии
   */
  getCurrentSession(): SessionInfo | null

  /**
   * Проверка активности сессии
   */
  isActive(): boolean

  /**
   * Обновление активности
   */
  updateActivity(): void
}