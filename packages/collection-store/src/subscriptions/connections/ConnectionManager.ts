/**
 * Connection Manager for Subscription System
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { EventEmitter } from 'events'
import type { User } from '../../auth/interfaces/types'
import type {
  Connection,
  ConnectionConfig,
  ConnectionStats,
  ConnectionMetadata,
  StreamOptions,
  ChunkData,
  StreamingSession
} from '../interfaces/types'
import { ConnectionError } from '../interfaces/types'

// WebSocket types (would be imported from 'ws' in real implementation)
interface WebSocket {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  on(event: string, listener: (...args: any[]) => void): void
  removeListener(event: string, listener: (...args: any[]) => void): void
}

// SSE Response types (would be from Express/Node.js)
interface SSEResponse {
  writeHead(statusCode: number, headers: Record<string, string>): void
  write(data: string): void
  end(): void
  on(event: string, listener: (...args: any[]) => void): void
}

export class ConnectionManager extends EventEmitter {
  private connections = new Map<string, Connection>()
  private userConnections = new Map<string, Set<string>>()
  private connectionsByProtocol = new Map<string, Set<string>>()
  private streamingSessions = new Map<string, StreamingSession>()
  private stats: ConnectionStats
  private cleanupInterval?: NodeJS.Timeout

  constructor(private config: ConnectionConfig) {
    super()
    this.initializeStats()
    this.startCleanupInterval()
  }

  /**
   * Create WebSocket connection
   */
  async createWebSocketConnection(
    ws: WebSocket,
    user: User,
    metadata: Partial<ConnectionMetadata> = {}
  ): Promise<Connection> {
    const connectionId = this.generateConnectionId()

    const connection: Connection = {
      id: connectionId,
      user,
      protocol: 'websocket',
      readyState: ws.readyState,
      subscriptions: new Set(),
      metadata: {
        protocol: 'websocket',
        userAgent: metadata.userAgent || 'unknown',
        ipAddress: metadata.ipAddress || 'unknown',
        connectedAt: new Date(),
        lastActivity: new Date(),
        ...metadata
      },
      transport: ws
    }

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers(ws, connection)

    // Store connection
    this.storeConnection(connection)

    // Update stats
    this.stats.totalConnections++
    this.stats.activeConnections++
    this.updateProtocolStats('websocket', 1)

    this.emit('connection_created', connection)
    return connection
  }

  /**
   * Create SSE connection
   */
  async createSSEConnection(
    res: SSEResponse,
    user: User,
    metadata: Partial<ConnectionMetadata> = {}
  ): Promise<Connection> {
    const connectionId = this.generateConnectionId()

    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    const connection: Connection = {
      id: connectionId,
      user,
      protocol: 'sse',
      readyState: 1, // Always open for SSE
      subscriptions: new Set(),
      metadata: {
        protocol: 'sse',
        userAgent: metadata.userAgent || 'unknown',
        ipAddress: metadata.ipAddress || 'unknown',
        connectedAt: new Date(),
        lastActivity: new Date(),
        ...metadata
      },
      transport: res
    }

    // Setup SSE event handlers
    this.setupSSEHandlers(res, connection)

    // Store connection
    this.storeConnection(connection)

    // Send initial connection message
    this.sendSSEMessage(res, 'connected', {
      connectionId,
      timestamp: Date.now()
    })

    // Update stats
    this.stats.totalConnections++
    this.stats.activeConnections++
    this.updateProtocolStats('sse', 1)

    this.emit('connection_created', connection)
    return connection
  }

  /**
   * Send message to connection
   */
  async sendMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new ConnectionError('Connection not found', { connectionId })
    }

    try {
      if (connection.protocol === 'websocket') {
        await this.sendWebSocketMessage(connection.transport as WebSocket, message)
      } else if (connection.protocol === 'sse') {
        await this.sendSSEMessage(connection.transport as SSEResponse, 'message', message)
      }

      // Update activity
      connection.metadata.lastActivity = new Date()
      this.stats.messagesSent++
    } catch (error) {
      this.stats.errors++
      throw new ConnectionError('Failed to send message', { connectionId, error: error.message })
    }
  }

  /**
   * Broadcast message to multiple connections
   */
  async broadcastMessage(connectionIds: string[], message: any): Promise<void> {
    const promises = connectionIds.map(id =>
      this.sendMessage(id, message).catch(error =>
        console.error(`Failed to send message to connection ${id}:`, error)
      )
    )

    await Promise.all(promises)
  }

  /**
   * Broadcast to all user connections
   */
  async broadcastToUser(userId: string, message: any): Promise<void> {
    const userConnectionIds = this.userConnections.get(userId)
    if (!userConnectionIds || userConnectionIds.size === 0) {
      return
    }

    await this.broadcastMessage(Array.from(userConnectionIds), message)
  }

  /**
   * Stream large dataset with chunked encoding (Priority 1 Fix)
   */
  async streamLargeDataset(
    connectionId: string,
    data: any[],
    options: StreamOptions = { chunkSize: 1000, compression: false, format: 'json' }
  ): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new ConnectionError('Connection not found', { connectionId })
    }

    if (connection.protocol !== 'sse') {
      throw new ConnectionError('Chunked streaming only supported for SSE connections', { connectionId })
    }

    const sessionId = this.generateStreamingSessionId()
    const chunks = this.chunkArray(data, options.chunkSize)

    // Create streaming session
    const session: StreamingSession = {
      id: sessionId,
      connectionId,
      totalChunks: chunks.length,
      sentChunks: 0,
      startTime: Date.now(),
      options
    }

    this.streamingSessions.set(sessionId, session)

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const isLast = i === chunks.length - 1

        const chunkData: ChunkData = {
          chunk: options.format === 'messagepack' ? this.encodeMessagePack(chunk) : chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          isLast,
          compressed: options.compression,
          format: options.format
        }

        await this.sendSSEMessage(connection.transport as SSEResponse, 'data_chunk', chunkData)

        // Update session progress
        session.sentChunks++

        // Prevent overwhelming the client
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        // Check if connection is still alive
        if (!this.isConnectionAlive(connectionId)) {
          throw new ConnectionError('Connection closed during streaming', { connectionId, sessionId })
        }
      }

      // Send completion message
      await this.sendSSEMessage(connection.transport as SSEResponse, 'stream_complete', {
        sessionId,
        totalChunks: chunks.length,
        duration: Date.now() - session.startTime
      })

    } catch (error) {
      // Send error message
      await this.sendSSEMessage(connection.transport as SSEResponse, 'stream_error', {
        sessionId,
        error: error.message,
        sentChunks: session.sentChunks,
        totalChunks: session.totalChunks
      })

      throw error
    } finally {
      // Cleanup session
      this.streamingSessions.delete(sessionId)
    }
  }

  /**
   * Get streaming session info
   */
  getStreamingSession(sessionId: string): StreamingSession | undefined {
    return this.streamingSessions.get(sessionId)
  }

  /**
   * Cancel streaming session
   */
  async cancelStreamingSession(sessionId: string): Promise<void> {
    const session = this.streamingSessions.get(sessionId)
    if (!session) {
      return
    }

    const connection = this.connections.get(session.connectionId)
    if (connection && connection.protocol === 'sse') {
      await this.sendSSEMessage(connection.transport as SSEResponse, 'stream_cancelled', {
        sessionId,
        sentChunks: session.sentChunks,
        totalChunks: session.totalChunks
      })
    }

    this.streamingSessions.delete(sessionId)
  }

  /**
   * Close connection
   */
  async closeConnection(connectionId: string, reason?: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    try {
      // Close transport
      if (connection.protocol === 'websocket') {
        const ws = connection.transport as WebSocket
        if (ws.readyState === 1) { // OPEN
          ws.close(1000, reason || 'Connection closed')
        }
      } else if (connection.protocol === 'sse') {
        const res = connection.transport as SSEResponse
        res.end()
      }

      // Remove from storage
      this.removeConnection(connection)

      // Update stats
      this.stats.activeConnections--
      this.updateProtocolStats(connection.protocol, -1)

      this.emit('connection_closed', connection, reason)
    } catch (error) {
      this.stats.errors++
      console.error(`Error closing connection ${connectionId}:`, error)
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get all user connections
   */
  getUserConnections(userId: string): Connection[] {
    const connectionIds = this.userConnections.get(userId)
    if (!connectionIds) {
      return []
    }

    const connections: Connection[] = []
    for (const id of connectionIds) {
      const connection = this.connections.get(id)
      if (connection) {
        connections.push(connection)
      }
    }

    return connections
  }

  /**
   * Get all active connections
   */
  getAllConnections(): Connection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats }
  }

  /**
   * Update connection activity
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.metadata.lastActivity = new Date()
    }
  }

  /**
   * Check if connection is alive
   */
  isConnectionAlive(connectionId: string): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return false
    }

    if (connection.protocol === 'websocket') {
      const ws = connection.transport as WebSocket
      return ws.readyState === 1 // OPEN
    }

    // SSE connections are considered alive if they exist
    return true
  }

  /**
   * Cleanup expired connections
   */
  async cleanupExpiredConnections(): Promise<number> {
    const now = Date.now()
    const expiredConnections: string[] = []

    for (const [id, connection] of this.connections) {
      const lastActivity = connection.metadata.lastActivity.getTime()
      const timeSinceActivity = now - lastActivity

      if (timeSinceActivity > this.config.connectionTimeout) {
        expiredConnections.push(id)
      }
    }

    // Close expired connections
    for (const id of expiredConnections) {
      await this.closeConnection(id, 'Connection timeout')
    }

    return expiredConnections.length
  }

  /**
   * Shutdown connection manager
   */
  async shutdown(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(id =>
      this.closeConnection(id, 'Server shutdown')
    )

    await Promise.all(closePromises)

    this.emit('shutdown')
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateStreamingSessionId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  private encodeMessagePack(data: any): any {
    // TODO: Implement MessagePack encoding when msgpack dependency is added
    // For now, return JSON as fallback
    return data
  }

  private storeConnection(connection: Connection): void {
    // Store in main map
    this.connections.set(connection.id, connection)

    // Index by user
    if (!this.userConnections.has(connection.user.id)) {
      this.userConnections.set(connection.user.id, new Set())
    }
    this.userConnections.get(connection.user.id)!.add(connection.id)

    // Index by protocol
    if (!this.connectionsByProtocol.has(connection.protocol)) {
      this.connectionsByProtocol.set(connection.protocol, new Set())
    }
    this.connectionsByProtocol.get(connection.protocol)!.add(connection.id)
  }

  private removeConnection(connection: Connection): void {
    // Remove from main map
    this.connections.delete(connection.id)

    // Remove from user index
    const userConnections = this.userConnections.get(connection.user.id)
    if (userConnections) {
      userConnections.delete(connection.id)
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.user.id)
      }
    }

    // Remove from protocol index
    const protocolConnections = this.connectionsByProtocol.get(connection.protocol)
    if (protocolConnections) {
      protocolConnections.delete(connection.id)
      if (protocolConnections.size === 0) {
        this.connectionsByProtocol.delete(connection.protocol)
      }
    }
  }

  private setupWebSocketHandlers(ws: WebSocket, connection: Connection): void {
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data)
        connection.metadata.lastActivity = new Date()
        this.stats.messagesReceived++
        this.emit('message_received', connection, message)
      } catch (error) {
        this.stats.errors++
        console.error('Error parsing WebSocket message:', error)
      }
    })

    ws.on('close', (code: number, reason: string) => {
      this.removeConnection(connection)
      this.stats.activeConnections--
      this.updateProtocolStats('websocket', -1)
      this.emit('connection_closed', connection, reason)
    })

    ws.on('error', (error: Error) => {
      this.stats.errors++
      this.emit('connection_error', connection, error)
    })

    // Setup ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      } else {
        clearInterval(pingInterval)
      }
    }, this.config.pingInterval || 30000)
  }

  private setupSSEHandlers(res: SSEResponse, connection: Connection): void {
    res.on('close', () => {
      this.removeConnection(connection)
      this.stats.activeConnections--
      this.updateProtocolStats('sse', -1)
      this.emit('connection_closed', connection, 'Client disconnected')
    })

    res.on('error', (error: Error) => {
      this.stats.errors++
      this.emit('connection_error', connection, error)
    })

    // Setup keep-alive for SSE
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(': keep-alive\n\n')
        connection.metadata.lastActivity = new Date()
      } catch (error) {
        clearInterval(keepAliveInterval)
        this.removeConnection(connection)
      }
    }, this.config.keepAliveInterval || 30000)
  }

  private async sendWebSocketMessage(ws: WebSocket, message: any): Promise<void> {
    if (ws.readyState !== 1) { // Not OPEN
      throw new Error('WebSocket is not open')
    }

    const data = JSON.stringify(message)
    ws.send(data)
  }

  private async sendSSEMessage(res: SSEResponse, event: string, data: any): Promise<void> {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    res.write(message)
  }

  private initializeStats(): void {
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      connectionsByProtocol: new Map(),
      averageConnectionDuration: 0,
      peakConnections: 0,
      startTime: new Date()
    }
  }

  private updateProtocolStats(protocol: string, delta: number): void {
    const current = this.stats.connectionsByProtocol.get(protocol) || 0
    const newValue = Math.max(0, current + delta)
    this.stats.connectionsByProtocol.set(protocol, newValue)

    // Update peak connections
    const totalActive = Array.from(this.stats.connectionsByProtocol.values())
      .reduce((sum, count) => sum + count, 0)

    if (totalActive > this.stats.peakConnections) {
      this.stats.peakConnections = totalActive
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredConnections(),
      this.config.cleanupInterval || 60000 // Every minute
    )
  }
}