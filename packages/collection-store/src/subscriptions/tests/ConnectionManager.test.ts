/**
 * Tests for ConnectionManager
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ConnectionManager } from '../connections/ConnectionManager'
import type { User } from '../../auth/interfaces/types'
import type { ConnectionConfig } from '../interfaces/types'

// Mock WebSocket
class MockWebSocket {
  readyState = 1 // OPEN
  private listeners = new Map<string, Function[]>()

  send(data: string) {
    // Mock send
  }

  close(code?: number, reason?: string) {
    this.readyState = 3 // CLOSED
    this.emit('close', code, reason)
  }

  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  removeListener(event: string, listener: Function) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(...args))
    }
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    this.emit('message', JSON.stringify(data))
  }
}

// Mock SSE Response
class MockSSEResponse {
  private listeners = new Map<string, Function[]>()
  private headers: Record<string, string> = {}
  private ended = false

  writeHead(statusCode: number, headers: Record<string, string>) {
    this.headers = { ...headers }
  }

  write(data: string) {
    if (this.ended) {
      throw new Error('Response ended')
    }
    // Mock write
  }

  end() {
    this.ended = true
    this.emit('close')
  }

  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(...args))
    }
  }

  // Simulate client disconnect
  simulateDisconnect() {
    this.emit('close')
  }

  // Simulate error
  simulateError(error: Error) {
    this.emit('error', error)
  }
}

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager
  let config: ConnectionConfig
  let mockUser: User

  beforeEach(() => {
    config = {
      maxConnections: 100,
      maxConnectionsPerUser: 10,
      connectionTimeout: 300000, // 5 minutes
      pingInterval: 30000,
      keepAliveInterval: 30000,
      cleanupInterval: 60000
    }

    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      passwordHash: 'hash',
      roles: ['user'],
      attributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    connectionManager = new ConnectionManager(config)
  })

  afterEach(async () => {
    await connectionManager.shutdown()
  })

  describe('WebSocket Connections', () => {
    it('should create WebSocket connection successfully', async () => {
      const mockWs = new MockWebSocket()

      const connection = await connectionManager.createWebSocketConnection(
        mockWs as any,
        mockUser,
        { userAgent: 'test-agent', ipAddress: '127.0.0.1' }
      )

      expect(connection.id).toMatch(/^conn_/)
      expect(connection.user).toBe(mockUser)
      expect(connection.protocol).toBe('websocket')
      expect(connection.readyState).toBe(1)
      expect(connection.subscriptions.size).toBe(0)
      expect(connection.metadata.userAgent).toBe('test-agent')
      expect(connection.metadata.ipAddress).toBe('127.0.0.1')
      expect(connection.metadata.protocol).toBe('websocket')
    })

    it('should handle WebSocket message events', async () => {
      const mockWs = new MockWebSocket()
      let receivedMessage: any = null

      connectionManager.on('message_received', (connection, message) => {
        receivedMessage = message
      })

      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      // Simulate receiving a message
      mockWs.simulateMessage({ type: 'test', data: 'hello' })

      expect(receivedMessage).toEqual({ type: 'test', data: 'hello' })
    })

         it('should handle WebSocket close events', async () => {
       const mockWs = new MockWebSocket()
       let closedConnection: any = null

       connectionManager.on('connection_closed', (connection, reason) => {
         closedConnection = { connection, reason }
       })

       const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

       // Simulate WebSocket close
       mockWs.close(1000, 'Normal closure')

       expect(closedConnection).not.toBeNull()
       expect(closedConnection!.connection.id).toBe(connection.id)
       expect(closedConnection!.reason).toBe('Normal closure')
     })

    it('should send WebSocket messages', async () => {
      const mockWs = new MockWebSocket()
      let sentData: string | null = null

      mockWs.send = (data: string) => {
        sentData = data
      }

      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      await connectionManager.sendMessage(connection.id, { type: 'test', data: 'hello' })

      expect(sentData).toBe(JSON.stringify({ type: 'test', data: 'hello' }))
    })
  })

  describe('SSE Connections', () => {
    it('should create SSE connection successfully', async () => {
      const mockRes = new MockSSEResponse()

      const connection = await connectionManager.createSSEConnection(
        mockRes as any,
        mockUser,
        { userAgent: 'test-agent', ipAddress: '127.0.0.1' }
      )

      expect(connection.id).toMatch(/^conn_/)
      expect(connection.user).toBe(mockUser)
      expect(connection.protocol).toBe('sse')
      expect(connection.readyState).toBe(1)
      expect(connection.subscriptions.size).toBe(0)
      expect(connection.metadata.userAgent).toBe('test-agent')
      expect(connection.metadata.ipAddress).toBe('127.0.0.1')
      expect(connection.metadata.protocol).toBe('sse')
    })

    it('should handle SSE close events', async () => {
      const mockRes = new MockSSEResponse()
      let closedConnection: any = null

      connectionManager.on('connection_closed', (connection, reason) => {
        closedConnection = { connection, reason }
      })

      const connection = await connectionManager.createSSEConnection(mockRes as any, mockUser)

      // Simulate SSE close
      mockRes.simulateDisconnect()

      expect(closedConnection).not.toBeNull()
      expect(closedConnection.connection.id).toBe(connection.id)
      expect(closedConnection.reason).toBe('Client disconnected')
    })

    it('should send SSE messages', async () => {
      const mockRes = new MockSSEResponse()
      let sentData: string | null = null

      mockRes.write = (data: string) => {
        sentData = data
      }

      const connection = await connectionManager.createSSEConnection(mockRes as any, mockUser)

      await connectionManager.sendMessage(connection.id, { type: 'test', data: 'hello' })

      expect(sentData).toContain('event: message')
      expect(sentData).toContain('data: {"type":"test","data":"hello"}')
    })
  })

  describe('Connection Management', () => {
    it('should get connection by ID', async () => {
      const mockWs = new MockWebSocket()
      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      const retrieved = connectionManager.getConnection(connection.id)
      expect(retrieved).toBe(connection)
    })

    it('should return undefined for non-existent connection', () => {
      const retrieved = connectionManager.getConnection('non-existent')
      expect(retrieved).toBeUndefined()
    })

    it('should get user connections', async () => {
      const mockWs1 = new MockWebSocket()
      const mockWs2 = new MockWebSocket()

      const connection1 = await connectionManager.createWebSocketConnection(mockWs1 as any, mockUser)
      const connection2 = await connectionManager.createWebSocketConnection(mockWs2 as any, mockUser)

      const userConnections = connectionManager.getUserConnections(mockUser.id)
      expect(userConnections).toHaveLength(2)
      expect(userConnections.map(c => c.id)).toContain(connection1.id)
      expect(userConnections.map(c => c.id)).toContain(connection2.id)
    })

    it('should get all connections', async () => {
      const mockWs = new MockWebSocket()
      const mockRes = new MockSSEResponse()

      await connectionManager.createWebSocketConnection(mockWs as any, mockUser)
      await connectionManager.createSSEConnection(mockRes as any, mockUser)

      const allConnections = connectionManager.getAllConnections()
      expect(allConnections).toHaveLength(2)
    })

    it('should close connection manually', async () => {
      const mockWs = new MockWebSocket()
      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      await connectionManager.closeConnection(connection.id, 'Manual close')

      const retrieved = connectionManager.getConnection(connection.id)
      expect(retrieved).toBeUndefined()
    })

    it('should check if connection is alive', async () => {
      const mockWs = new MockWebSocket()
      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      expect(connectionManager.isConnectionAlive(connection.id)).toBe(true)

      mockWs.readyState = 3 // CLOSED
      expect(connectionManager.isConnectionAlive(connection.id)).toBe(false)
    })

    it('should update connection activity', async () => {
      const mockWs = new MockWebSocket()
      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      const originalActivity = connection.metadata.lastActivity

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      connectionManager.updateActivity(connection.id)

      expect(connection.metadata.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime())
    })
  })

  describe('Broadcasting', () => {
    it('should broadcast message to multiple connections', async () => {
      const mockWs1 = new MockWebSocket()
      const mockWs2 = new MockWebSocket()
      const sentMessages: string[] = []

      mockWs1.send = (data: string) => sentMessages.push(data)
      mockWs2.send = (data: string) => sentMessages.push(data)

      const connection1 = await connectionManager.createWebSocketConnection(mockWs1 as any, mockUser)
      const connection2 = await connectionManager.createWebSocketConnection(mockWs2 as any, mockUser)

      await connectionManager.broadcastMessage(
        [connection1.id, connection2.id],
        { type: 'broadcast', data: 'hello all' }
      )

      expect(sentMessages).toHaveLength(2)
      expect(sentMessages[0]).toBe(JSON.stringify({ type: 'broadcast', data: 'hello all' }))
      expect(sentMessages[1]).toBe(JSON.stringify({ type: 'broadcast', data: 'hello all' }))
    })

    it('should broadcast to all user connections', async () => {
      const mockWs1 = new MockWebSocket()
      const mockWs2 = new MockWebSocket()
      const sentMessages: string[] = []

      mockWs1.send = (data: string) => sentMessages.push(data)
      mockWs2.send = (data: string) => sentMessages.push(data)

      await connectionManager.createWebSocketConnection(mockWs1 as any, mockUser)
      await connectionManager.createWebSocketConnection(mockWs2 as any, mockUser)

      await connectionManager.broadcastToUser(mockUser.id, { type: 'user_broadcast', data: 'hello user' })

      expect(sentMessages).toHaveLength(2)
      expect(sentMessages[0]).toBe(JSON.stringify({ type: 'user_broadcast', data: 'hello user' }))
      expect(sentMessages[1]).toBe(JSON.stringify({ type: 'user_broadcast', data: 'hello user' }))
    })
  })

  describe('Statistics', () => {
    it('should track connection statistics', async () => {
      const mockWs = new MockWebSocket()
      const mockRes = new MockSSEResponse()

      const initialStats = connectionManager.getStats()
      expect(initialStats.totalConnections).toBe(0)
      expect(initialStats.activeConnections).toBe(0)

      await connectionManager.createWebSocketConnection(mockWs as any, mockUser)
      await connectionManager.createSSEConnection(mockRes as any, mockUser)

      const stats = connectionManager.getStats()
      expect(stats.totalConnections).toBe(2)
      expect(stats.activeConnections).toBe(2)
      expect(stats.connectionsByProtocol.get('websocket')).toBe(1)
      expect(stats.connectionsByProtocol.get('sse')).toBe(1)
    })

    it('should track peak connections', async () => {
      const mockWs1 = new MockWebSocket()
      const mockWs2 = new MockWebSocket()
      const mockWs3 = new MockWebSocket()

      await connectionManager.createWebSocketConnection(mockWs1 as any, mockUser)
      await connectionManager.createWebSocketConnection(mockWs2 as any, mockUser)
      await connectionManager.createWebSocketConnection(mockWs3 as any, mockUser)

      const stats = connectionManager.getStats()
      expect(stats.peakConnections).toBe(3)

      // Close one connection
      mockWs1.close()

      // Peak should still be 3
      const statsAfterClose = connectionManager.getStats()
      expect(statsAfterClose.peakConnections).toBe(3)
      expect(statsAfterClose.activeConnections).toBe(2)
    })
  })

  describe('Cleanup and Maintenance', () => {
    it('should cleanup expired connections', async () => {
      // Create connection manager with very short timeout
      const shortTimeoutConfig = { ...config, connectionTimeout: 100 }
      const shortTimeoutManager = new ConnectionManager(shortTimeoutConfig)

      const mockWs = new MockWebSocket()
      const connection = await shortTimeoutManager.createWebSocketConnection(mockWs as any, mockUser)

      // Wait for connection to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      const cleanedUp = await shortTimeoutManager.cleanupExpiredConnections()
      expect(cleanedUp).toBe(1)

      const retrieved = shortTimeoutManager.getConnection(connection.id)
      expect(retrieved).toBeUndefined()

      await shortTimeoutManager.shutdown()
    })

    it('should shutdown gracefully', async () => {
      const mockWs = new MockWebSocket()
      const mockRes = new MockSSEResponse()

      await connectionManager.createWebSocketConnection(mockWs as any, mockUser)
      await connectionManager.createSSEConnection(mockRes as any, mockUser)

      let shutdownEmitted = false
      connectionManager.on('shutdown', () => {
        shutdownEmitted = true
      })

      await connectionManager.shutdown()

      expect(shutdownEmitted).toBe(true)
      expect(connectionManager.getAllConnections()).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle WebSocket errors', async () => {
      const mockWs = new MockWebSocket()
      let errorEmitted: any = null

      connectionManager.on('connection_error', (connection, error) => {
        errorEmitted = { connection, error }
      })

      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      const testError = new Error('WebSocket error')
      mockWs.emit('error', testError)

      expect(errorEmitted).not.toBeNull()
      expect(errorEmitted.connection.id).toBe(connection.id)
      expect(errorEmitted.error).toBe(testError)
    })

    it('should handle SSE errors', async () => {
      const mockRes = new MockSSEResponse()
      let errorEmitted: any = null

      connectionManager.on('connection_error', (connection, error) => {
        errorEmitted = { connection, error }
      })

      const connection = await connectionManager.createSSEConnection(mockRes as any, mockUser)

      const testError = new Error('SSE error')
      mockRes.simulateError(testError)

      expect(errorEmitted).not.toBeNull()
      expect(errorEmitted.connection.id).toBe(connection.id)
      expect(errorEmitted.error).toBe(testError)
    })

    it('should handle sending message to non-existent connection', async () => {
      await expect(
        connectionManager.sendMessage('non-existent', { type: 'test' })
      ).rejects.toThrow('Connection not found')
    })

    it('should handle sending message to closed WebSocket', async () => {
      const mockWs = new MockWebSocket()
      const connection = await connectionManager.createWebSocketConnection(mockWs as any, mockUser)

      mockWs.readyState = 3 // CLOSED

      await expect(
        connectionManager.sendMessage(connection.id, { type: 'test' })
      ).rejects.toThrow('Failed to send message')
    })
  })
})