/**
 * Phase 5: Client Integration - Connection Manager
 *
 * Менеджер для управления соединениями (WebSocket/HTTP) с автоматическим переподключением
 */

import { EventEmitter } from 'events'
import { IConnectionManager } from '../interfaces/ISession'
import {
  ConnectionType,
  ConnectionState,
  ConnectionConfig,
  ConnectionInfo,
  SessionEvent,
  SessionEventType,
  RetryConfig,
  HeartbeatConfig
} from '../interfaces/types'

/**
 * Информация о соединении для внутреннего использования
 */
interface InternalConnectionInfo extends ConnectionInfo {
  socket?: WebSocket
  heartbeatTimer?: NodeJS.Timeout
  reconnectTimer?: NodeJS.Timeout
  lastPingAt?: Date
  missedHeartbeats: number
}

/**
 * Менеджер соединений
 */
export class ConnectionManager extends EventEmitter implements IConnectionManager {
  private connections: Map<string, InternalConnectionInfo> = new Map()
  private configs: Map<string, ConnectionConfig> = new Map()
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private eventHandlers: Map<string, Set<(event: SessionEvent) => void>> = new Map()
  private testMode: boolean = false

  constructor(testMode: boolean = false) {
    super()
    this.testMode = testMode || process.env.NODE_ENV === 'test'
  }

  /**
   * Установка соединения
   */
  async connect(sessionId: string): Promise<void> {
    const config = this.configs.get(sessionId)
    if (!config) {
      throw new Error(`No connection config found for session ${sessionId}`)
    }

    const connectionInfo: InternalConnectionInfo = {
      type: config.type,
      state: 'connecting',
      url: config.url,
      reconnectAttempts: 0,
      missedHeartbeats: 0
    }

    this.connections.set(sessionId, connectionInfo)
    this.emitConnectionEvent(sessionId, 'connection_established', { connecting: true })

    try {
      if (this.testMode) {
        // Мок соединение для тестов
        await this.connectMock(sessionId, config, connectionInfo)
      } else {
        switch (config.type) {
          case 'websocket':
            await this.connectWebSocket(sessionId, config, connectionInfo)
            break
          case 'http':
            await this.connectHttp(sessionId, config, connectionInfo)
            break
          case 'hybrid':
            await this.connectHybrid(sessionId, config, connectionInfo)
            break
          default:
            throw new Error(`Unsupported connection type: ${config.type}`)
        }
      }

      connectionInfo.state = 'connected'
      connectionInfo.connectedAt = new Date()
      connectionInfo.reconnectAttempts = 0

      // Настройка heartbeat
      if (config.heartbeat.enabled && !this.testMode) {
        this.setupHeartbeat(sessionId)
      }

      this.emitConnectionEvent(sessionId, 'connection_established', { connected: true })

    } catch (error) {
      connectionInfo.state = 'error'
      this.emitConnectionEvent(sessionId, 'error_occurred', { error })

      // Попытка переподключения
      if (config.retryConfig.maxAttempts > 0 && !this.testMode) {
        await this.scheduleReconnect(sessionId)
      }

      throw error
    }
  }

  /**
   * Мок соединение для тестов
   */
  private async connectMock(sessionId: string, config: ConnectionConfig, connection: InternalConnectionInfo): Promise<void> {
    // Симуляция задержки соединения
    await new Promise(resolve => setTimeout(resolve, 10))

    // Мок успешного соединения
    connection.latency = 50
    connection.lastHeartbeatAt = new Date()
  }

  /**
   * Закрытие соединения
   */
  async disconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      return
    }

    // Остановка heartbeat
    this.stopHeartbeat(sessionId)

    // Остановка таймера переподключения
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer)
      connection.reconnectTimer = undefined
    }

    // Закрытие соединения
    if (connection.socket) {
      connection.socket.close()
      connection.socket = undefined
    }

    connection.state = 'disconnected'
    this.emitConnectionEvent(sessionId, 'connection_lost')

    // Очистка обработчиков
    this.messageHandlers.delete(sessionId)
    this.eventHandlers.delete(sessionId)
    this.connections.delete(sessionId)
  }

  /**
   * Переподключение
   */
  async reconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      throw new Error(`Connection ${sessionId} not found`)
    }

    connection.state = 'reconnecting'
    connection.reconnectAttempts++

    this.emitConnectionEvent(sessionId, 'connection_lost', { reconnecting: true })

    try {
      await this.disconnect(sessionId)
      await this.connect(sessionId)

      this.emitConnectionEvent(sessionId, 'connection_restored')
    } catch (error) {
      const config = this.configs.get(sessionId)
      if (config && connection.reconnectAttempts < config.retryConfig.maxAttempts) {
        await this.scheduleReconnect(sessionId)
      } else {
        connection.state = 'error'
        this.emitConnectionEvent(sessionId, 'error_occurred', {
          error,
          maxAttemptsReached: true
        })
      }
      throw error
    }
  }

  /**
   * Проверка состояния соединения
   */
  isConnected(sessionId: string): boolean {
    const connection = this.connections.get(sessionId)
    return connection?.state === 'connected'
  }

  /**
   * Отправка данных
   */
  async send(sessionId: string, data: any): Promise<void> {
    const connection = this.connections.get(sessionId)
    if (!connection || connection.state !== 'connected') {
      throw new Error(`Connection ${sessionId} is not connected`)
    }

    const config = this.configs.get(sessionId)
    if (!config) {
      throw new Error(`No config found for session ${sessionId}`)
    }

    try {
      switch (config.type) {
        case 'websocket':
          if (connection.socket) {
            connection.socket.send(JSON.stringify(data))
          }
          break
        case 'http':
          await this.sendHttp(sessionId, data)
          break
        case 'hybrid':
          // Выбор лучшего метода отправки
          if (connection.socket && connection.socket.readyState === WebSocket.OPEN) {
            connection.socket.send(JSON.stringify(data))
          } else {
            await this.sendHttp(sessionId, data)
          }
          break
      }
    } catch (error) {
      this.emitConnectionEvent(sessionId, 'error_occurred', { error, operation: 'send' })
      throw error
    }
  }

  /**
   * Подписка на сообщения
   */
  onMessage(sessionId: string, callback: (data: any) => void): () => void {
    if (!this.messageHandlers.has(sessionId)) {
      this.messageHandlers.set(sessionId, new Set())
    }

    this.messageHandlers.get(sessionId)!.add(callback)

    return () => {
      const handlers = this.messageHandlers.get(sessionId)
      if (handlers) {
        handlers.delete(callback)
        if (handlers.size === 0) {
          this.messageHandlers.delete(sessionId)
        }
      }
    }
  }

  /**
   * Подписка на события соединения
   */
  onConnectionEvent(sessionId: string, callback: (event: SessionEvent) => void): () => void {
    if (!this.eventHandlers.has(sessionId)) {
      this.eventHandlers.set(sessionId, new Set())
    }

    this.eventHandlers.get(sessionId)!.add(callback)

    return () => {
      const handlers = this.eventHandlers.get(sessionId)
      if (handlers) {
        handlers.delete(callback)
        if (handlers.size === 0) {
          this.eventHandlers.delete(sessionId)
        }
      }
    }
  }

  /**
   * Получение статистики соединения
   */
  async getConnectionStats(sessionId: string): Promise<any> {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      throw new Error(`Connection ${sessionId} not found`)
    }

    const now = Date.now()
    const connectedDuration = connection.connectedAt
      ? now - connection.connectedAt.getTime()
      : 0

    return {
      sessionId,
      type: connection.type,
      state: connection.state,
      url: connection.url,
      connectedAt: connection.connectedAt,
      connectedDuration,
      reconnectAttempts: connection.reconnectAttempts,
      latency: connection.latency || 0,
      bandwidth: connection.bandwidth || 0,
      lastHeartbeatAt: connection.lastHeartbeatAt,
      missedHeartbeats: connection.missedHeartbeats
    }
  }

  /**
   * Настройка heartbeat
   */
  setupHeartbeat(sessionId: string): void {
    const config = this.configs.get(sessionId)
    const connection = this.connections.get(sessionId)

    if (!config || !connection || !config.heartbeat.enabled) {
      return
    }

    // Остановка существующего heartbeat
    this.stopHeartbeat(sessionId)

    connection.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(sessionId)
    }, config.heartbeat.interval)
  }

  /**
   * Остановка heartbeat
   */
  stopHeartbeat(sessionId: string): void {
    const connection = this.connections.get(sessionId)
    if (connection?.heartbeatTimer) {
      clearInterval(connection.heartbeatTimer)
      connection.heartbeatTimer = undefined
    }
  }

  /**
   * Настройка конфигурации соединения
   */
  setConnectionConfig(sessionId: string, config: ConnectionConfig): void {
    this.configs.set(sessionId, config)
  }

  /**
   * Получение конфигурации соединения
   */
  getConnectionConfig(sessionId: string): ConnectionConfig | undefined {
    return this.configs.get(sessionId)
  }

  /**
   * Приватные методы
   */

  private async connectWebSocket(sessionId: string, config: ConnectionConfig, connection: InternalConnectionInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(config.url, config.protocols)

      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('WebSocket connection timeout'))
      }, config.timeout)

      socket.onopen = () => {
        clearTimeout(timeout)
        connection.socket = socket
        this.setupWebSocketHandlers(sessionId, socket)
        resolve()
      }

      socket.onerror = (error) => {
        clearTimeout(timeout)
        reject(new Error(`WebSocket connection failed: ${error}`))
      }

      socket.onclose = () => {
        clearTimeout(timeout)
        if (connection.state === 'connected') {
          // Неожиданное закрытие - попытка переподключения
          this.handleUnexpectedDisconnect(sessionId)
        }
      }
    })
  }

  private async connectHttp(sessionId: string, config: ConnectionConfig, connection: InternalConnectionInfo): Promise<void> {
    // HTTP соединение - проверка доступности через ping
    try {
      const response = await fetch(`${config.url}/ping`, {
        method: 'GET',
        headers: config.headers,
        signal: AbortSignal.timeout(config.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP connection failed: ${response.status}`)
      }
    } catch (error) {
      throw new Error(`HTTP connection failed: ${error}`)
    }
  }

  private async connectHybrid(sessionId: string, config: ConnectionConfig, connection: InternalConnectionInfo): Promise<void> {
    // Попытка WebSocket соединения, fallback на HTTP
    try {
      await this.connectWebSocket(sessionId, config, connection)
    } catch (wsError) {
      console.warn(`WebSocket failed for ${sessionId}, falling back to HTTP:`, wsError)
      await this.connectHttp(sessionId, config, connection)
    }
  }

  private setupWebSocketHandlers(sessionId: string, socket: WebSocket): void {
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(sessionId, data)
      } catch (error) {
        this.emitConnectionEvent(sessionId, 'error_occurred', {
          error: new Error('Failed to parse message'),
          rawData: event.data
        })
      }
    }

    socket.onerror = (error) => {
      this.emitConnectionEvent(sessionId, 'error_occurred', { error })
    }

    socket.onclose = () => {
      const connection = this.connections.get(sessionId)
      if (connection && connection.state === 'connected') {
        this.handleUnexpectedDisconnect(sessionId)
      }
    }
  }

  private handleMessage(sessionId: string, data: any): void {
    // Обработка heartbeat ответов
    if (data.type === 'pong') {
      this.handleHeartbeatResponse(sessionId, data)
      return
    }

    // Передача сообщения обработчикам
    const handlers = this.messageHandlers.get(sessionId)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          this.emitConnectionEvent(sessionId, 'error_occurred', {
            error,
            operation: 'message_handler'
          })
        }
      })
    }
  }

  private async sendHeartbeat(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)
    const config = this.configs.get(sessionId)

    if (!connection || !config) {
      return
    }

    try {
      const pingData = {
        type: 'ping',
        timestamp: Date.now(),
        sessionId
      }

      connection.lastPingAt = new Date()
      await this.send(sessionId, pingData)

      // Таймер для проверки ответа
      setTimeout(() => {
        this.checkHeartbeatResponse(sessionId)
      }, config.heartbeat.timeout)

    } catch (error) {
      this.handleHeartbeatFailure(sessionId)
    }
  }

  private handleHeartbeatResponse(sessionId: string, data: any): void {
    const connection = this.connections.get(sessionId)
    if (!connection || !connection.lastPingAt) {
      return
    }

    // Расчет latency
    const latency = Date.now() - connection.lastPingAt.getTime()
    connection.latency = latency
    connection.lastHeartbeatAt = new Date()
    connection.missedHeartbeats = 0
  }

  private checkHeartbeatResponse(sessionId: string): void {
    const connection = this.connections.get(sessionId)
    const config = this.configs.get(sessionId)

    if (!connection || !config) {
      return
    }

    const timeSinceLastHeartbeat = connection.lastHeartbeatAt
      ? Date.now() - connection.lastHeartbeatAt.getTime()
      : Date.now() - (connection.lastPingAt?.getTime() || 0)

    if (timeSinceLastHeartbeat > config.heartbeat.timeout) {
      connection.missedHeartbeats++

      if (connection.missedHeartbeats >= config.heartbeat.maxMissed) {
        this.handleHeartbeatFailure(sessionId)
      }
    }
  }

  private handleHeartbeatFailure(sessionId: string): void {
    this.emitConnectionEvent(sessionId, 'connection_lost', { reason: 'heartbeat_failure' })
    this.handleUnexpectedDisconnect(sessionId)
  }

  private async handleUnexpectedDisconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)
    const config = this.configs.get(sessionId)

    if (!connection || !config) {
      return
    }

    connection.state = 'disconnected'
    this.emitConnectionEvent(sessionId, 'connection_lost', { unexpected: true })

    // Автоматическое переподключение
    if (config.retryConfig.maxAttempts > 0 &&
        connection.reconnectAttempts < config.retryConfig.maxAttempts) {
      await this.scheduleReconnect(sessionId)
    }
  }

  private async scheduleReconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)
    const config = this.configs.get(sessionId)

    if (!connection || !config) {
      return
    }

    const delay = this.calculateReconnectDelay(connection.reconnectAttempts, config.retryConfig)

    connection.reconnectTimer = setTimeout(async () => {
      try {
        await this.reconnect(sessionId)
      } catch (error) {
        // Ошибка обрабатывается в методе reconnect
      }
    }, delay)
  }

  private calculateReconnectDelay(attempt: number, retryConfig: RetryConfig): number {
    let delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, attempt)
    delay = Math.min(delay, retryConfig.maxDelay)

    if (retryConfig.jitter) {
      delay += Math.random() * 1000 // Добавление случайной задержки до 1 секунды
    }

    return delay
  }

  private async sendHttp(sessionId: string, data: any): Promise<void> {
    const config = this.configs.get(sessionId)
    if (!config) {
      throw new Error(`No config found for session ${sessionId}`)
    }

    const response = await fetch(`${config.url}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(config.timeout)
    })

    if (!response.ok) {
      throw new Error(`HTTP send failed: ${response.status}`)
    }
  }

  private emitConnectionEvent(sessionId: string, type: SessionEventType, data?: any): void {
    const event: SessionEvent = {
      type,
      sessionId,
      timestamp: new Date(),
      data
    }

    // Отправка глобального события
    this.emit('connectionEvent', event)

    // Отправка события конкретным обработчикам сессии
    const handlers = this.eventHandlers.get(sessionId)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error(`Error in connection event handler for ${sessionId}:`, error)
        }
      })
    }
  }
}