/**
 * Tests for NotificationManager
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { NotificationManager } from '../notifications/NotificationManager'
import type { User } from '../../auth/interfaces/types'
import type {
  NotificationConfig,
  DataChange,
  Subscription,
  Connection,
  ParsedSubscriptionQuery
} from '../interfaces/types'

// Mock connection
const createMockConnection = (id: string, protocol: 'websocket' | 'sse' = 'websocket'): Connection => {
  const mockTransport = {
    readyState: 1,
    send: () => {},
    write: () => {}
  }

  return {
    id,
    user: {
      id: 'user123',
      email: 'test@example.com',
      passwordHash: 'hash',
      roles: ['user'],
      attributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    } as User,
    protocol,
    readyState: 1,
    subscriptions: new Set(),
    metadata: {
      protocol,
      userAgent: 'test',
      ipAddress: '127.0.0.1',
      connectedAt: new Date(),
      lastActivity: new Date()
    },
    transport: mockTransport
  }
}

// Mock subscription
const createMockSubscription = (id: string, connectionId: string): Subscription => {
  const connection = createMockConnection(connectionId)

  return {
    id,
    userId: 'user123',
    query: {
      id: 'query123',
      resourceType: 'collection',
      collection: 'users',
      filters: [],
      options: {
        includeInitialData: false,
        includeMetadata: true,
        batchSize: 100,
        throttleMs: 0
      }
    } as ParsedSubscriptionQuery,
    connection,
    context: {
      tabId: 'tab123'
    },
    createdAt: new Date(),
    lastActivity: new Date(),
    status: 'active',
    metadata: {
      protocol: 'websocket'
    }
  }
}

// Mock data change
const createMockDataChange = (): DataChange => ({
  id: 'change123',
  resourceType: 'collection',
  database: 'testdb',
  collection: 'users',
  documentId: 'user123',
  operation: 'insert',
  data: { name: 'John', email: 'john@example.com' },
  timestamp: Date.now()
})

describe('NotificationManager', () => {
  let notificationManager: NotificationManager
  let config: NotificationConfig

  beforeEach(async () => {
    config = {
      batchSize: 5,
      batchTimeoutMs: 100,
      maxRetries: 3,
      retryDelayMs: 50
    }

    notificationManager = new NotificationManager(config)
    await notificationManager.start()
  })

  afterEach(async () => {
    await notificationManager.stop()
  })

  describe('Lifecycle Management', () => {
    it('should start and stop correctly', async () => {
      const manager = new NotificationManager(config)

      let startedEmitted = false
      let stoppedEmitted = false

      manager.on('started', () => { startedEmitted = true })
      manager.on('stopped', () => { stoppedEmitted = true })

      await manager.start()
      expect(startedEmitted).toBe(true)

      await manager.stop()
      expect(stoppedEmitted).toBe(true)
    })

    it('should not start if already running', async () => {
      const manager = new NotificationManager(config)
      await manager.start()

      // Should not throw or emit again
      await manager.start()

      await manager.stop()
    })

    it('should not stop if not running', async () => {
      const manager = new NotificationManager(config)

      // Should not throw
      await manager.stop()
    })
  })

  describe('Single Notifications', () => {
    it('should send high priority notification immediately', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      const result = await notificationManager.sendNotification(subscription, change, 'high')

      expect(result.success).toBe(true)
      expect(result.subscriptionId).toBe('sub123')
      expect(result.batched).toBeUndefined()
    })

    it('should batch normal priority notifications', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      const result = await notificationManager.sendNotification(subscription, change, 'normal')

      expect(result.success).toBe(true)
      expect(result.subscriptionId).toBe('sub123')
      expect(result.batched).toBe(true)
    })

    it('should handle notification when manager is stopped', async () => {
      await notificationManager.stop()

      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      const result = await notificationManager.sendNotification(subscription, change)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Notification manager not running')
    })
  })

  describe('Batch Notifications', () => {
    it('should send multiple notifications', async () => {
      const subscription1 = createMockSubscription('sub1', 'conn1')
      const subscription2 = createMockSubscription('sub2', 'conn2')
      const change = createMockDataChange()

      const notifications = [
        { subscription: subscription1, change, priority: 'normal' as const },
        { subscription: subscription2, change, priority: 'high' as const }
      ]

      const results = await notificationManager.sendNotifications(notifications)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })

    it('should flush batch when size limit reached', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      // Send enough notifications to trigger batch flush
      const promises = []
      for (let i = 0; i < config.batchSize; i++) {
        promises.push(notificationManager.sendNotification(subscription, change, 'normal'))
      }

      const results = await Promise.all(promises)

      expect(results).toHaveLength(config.batchSize)
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.batched).toBe(true)
      })
    })

    it('should flush batch after timeout', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      // Send one notification to start batch
      await notificationManager.sendNotification(subscription, change, 'normal')

      expect(notificationManager.getPendingCount()).toBe(1)

      // Wait for batch timeout
      await new Promise(resolve => setTimeout(resolve, config.batchTimeoutMs + 50))

      expect(notificationManager.getPendingCount()).toBe(0)
    })
  })

  describe('Broadcasting', () => {
    it('should broadcast change to multiple subscriptions', async () => {
      const subscription1 = createMockSubscription('sub1', 'conn1')
      const subscription2 = createMockSubscription('sub2', 'conn2')
      const change = createMockDataChange()

      const results = await notificationManager.broadcastChange(change, [subscription1, subscription2])

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })

    it('should handle empty subscription list', async () => {
      const change = createMockDataChange()

      const results = await notificationManager.broadcastChange(change, [])

      expect(results).toHaveLength(0)
    })
  })

  describe('Connection Notifications', () => {
    it('should send message to specific connection', async () => {
      const connection = createMockConnection('conn123')
      const message = { type: 'test', data: 'hello' }

      const result = await notificationManager.sendToConnection(connection, message, 'high')

      expect(result.success).toBe(true)
      expect(result.connectionId).toBe('conn123')
    })

    it('should batch connection messages', async () => {
      const connection = createMockConnection('conn123')
      const message = { type: 'test', data: 'hello' }

      const result = await notificationManager.sendToConnection(connection, message, 'normal')

      expect(result.success).toBe(true)
      expect(result.connectionId).toBe('conn123')
      expect(result.batched).toBe(true)
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should provide notification statistics', async () => {
      const stats = notificationManager.getStats()

      expect(stats).toHaveProperty('sent')
      expect(stats).toHaveProperty('errors')
      expect(stats).toHaveProperty('batched')
      expect(stats).toHaveProperty('immediate')
      expect(stats).toHaveProperty('retries')
      expect(stats).toHaveProperty('averageLatency')
      expect(stats).toHaveProperty('peakThroughput')
      expect(stats).toHaveProperty('startTime')
    })

    it('should track pending notification count', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      expect(notificationManager.getPendingCount()).toBe(0)

      // Add some notifications to batch
      await notificationManager.sendNotification(subscription, change, 'normal')
      await notificationManager.sendNotification(subscription, change, 'normal')

      expect(notificationManager.getPendingCount()).toBe(2)
    })

    it('should provide health status', async () => {
      const health = notificationManager.getHealth()

      expect(health).toHaveProperty('status')
      expect(health).toHaveProperty('pendingCount')
      expect(health).toHaveProperty('errorRate')
      expect(health).toHaveProperty('uptime')
      expect(health.status).toBe('healthy')
    })
  })

  describe('Batch Management', () => {
    it('should flush all pending notifications on stop', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      // Add some notifications to batch
      await notificationManager.sendNotification(subscription, change, 'normal')
      await notificationManager.sendNotification(subscription, change, 'normal')

      expect(notificationManager.getPendingCount()).toBe(2)

      // Stop should flush all pending
      await notificationManager.stop()

      expect(notificationManager.getPendingCount()).toBe(0)
    })

    it('should manually flush all pending notifications', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')
      const change = createMockDataChange()

      // Add some notifications to batch
      await notificationManager.sendNotification(subscription, change, 'normal')
      await notificationManager.sendNotification(subscription, change, 'normal')

      expect(notificationManager.getPendingCount()).toBe(2)

      // Manual flush
      await notificationManager.flushAllPendingNotifications()

      expect(notificationManager.getPendingCount()).toBe(0)
    })
  })

  describe('Protocol Support', () => {
    it('should handle WebSocket notifications', async () => {
      const connection = createMockConnection('conn123', 'websocket')
      const subscription = createMockSubscription('sub123', 'conn123')
      subscription.connection = connection

      const change = createMockDataChange()

      const result = await notificationManager.sendNotification(subscription, change, 'high')

      expect(result.success).toBe(true)
    })

    it('should handle SSE notifications', async () => {
      const connection = createMockConnection('conn123', 'sse')
      const subscription = createMockSubscription('sub123', 'conn123')
      subscription.connection = connection

      const change = createMockDataChange()

      const result = await notificationManager.sendNotification(subscription, change, 'high')

      expect(result.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', async () => {
      const connection = createMockConnection('conn123')
      // Make transport throw error
      connection.transport.send = () => {
        throw new Error('Transport error')
      }

      const subscription = createMockSubscription('sub123', 'conn123')
      subscription.connection = connection

      const change = createMockDataChange()

      const result = await notificationManager.sendNotification(subscription, change, 'high')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Transport error')
    })

    it('should track error statistics', async () => {
      const connection = createMockConnection('conn123')
      connection.transport.send = () => {
        throw new Error('Transport error')
      }

      const subscription = createMockSubscription('sub123', 'conn123')
      subscription.connection = connection

      const change = createMockDataChange()

      await notificationManager.sendNotification(subscription, change, 'high')

      const stats = notificationManager.getStats()
      expect(stats.errors).toBe(1)
    })
  })

  describe('Priority Handling', () => {
    it('should determine priority based on change type', async () => {
      const subscription = createMockSubscription('sub123', 'conn123')

      // Delete operations should be high priority
      const deleteChange: DataChange = {
        ...createMockDataChange(),
        operation: 'delete'
      }

      const results = await notificationManager.broadcastChange(deleteChange, [subscription])

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
    })

    it('should handle mixed priority notifications', async () => {
      const subscription1 = createMockSubscription('sub1', 'conn1')
      const subscription2 = createMockSubscription('sub2', 'conn2')
      const change = createMockDataChange()

      const notifications = [
        { subscription: subscription1, change, priority: 'high' as const },
        { subscription: subscription2, change, priority: 'normal' as const }
      ]

      const results = await notificationManager.sendNotifications(notifications)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[0].batched).toBeUndefined() // High priority = immediate
      expect(results[1].success).toBe(true)
      expect(results[1].batched).toBe(true) // Normal priority = batched
    })
  })
})