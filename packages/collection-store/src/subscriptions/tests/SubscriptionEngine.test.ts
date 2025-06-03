/**
 * Tests for SubscriptionEngine
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SubscriptionEngine } from '../core/SubscriptionEngine'
import type { User } from '../../auth/interfaces/types'
import type { SubscriptionQuery, Connection, SubscriptionConfig } from '../interfaces/types'

// Mock implementations for testing
class MockCSDatabase {
  constructor() {}
}

class MockAuthorizationEngine {
  async checkPermission(user: User, resource: any, action: string, context?: any) {
    return { allowed: true, reason: 'test' }
  }
}

class MockAuditLogger {
  async log(entry: any): Promise<void> {
    // Mock implementation
  }
}

class MockConnection implements Connection {
  id: string
  userId: string
  user: User
  authenticated: boolean = true
  createdAt: Date = new Date()
  lastActivity: Date = new Date()
  subscriptions: Set<string> = new Set()
  metadata = { protocol: 'websocket' as const }
  readyState: number = 1

  constructor(user: User) {
    this.id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.userId = user.id
    this.user = user
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3 // CLOSED
  }
}

describe('SubscriptionEngine', () => {
  let engine: SubscriptionEngine
  let mockDatabase: MockCSDatabase
  let mockAuthEngine: MockAuthorizationEngine
  let mockAuditLogger: MockAuditLogger
  let testUser: User
  let testConnection: MockConnection
  let config: SubscriptionConfig

  beforeEach(() => {
    // Setup mocks
    mockDatabase = new MockCSDatabase()
    mockAuthEngine = new MockAuthorizationEngine()
    mockAuditLogger = new MockAuditLogger()

    // Test configuration
    config = {
      query: {
        maxFilters: 10,
        allowCustomFilters: true,
        defaultBatchSize: 100,
        maxBatchSize: 1000,
        defaultThrottleMs: 0,
        maxThrottleMs: 5000
      },
      filtering: {
        enableCaching: true,
        cacheTTL: 300,
        maxCacheSize: 1000
      },
      notifications: {
        batchSize: 50,
        batchTimeoutMs: 1000,
        maxRetries: 3,
        retryDelayMs: 1000
      },
      connections: {
        maxConnections: 1000,
        maxConnectionsPerUser: 10,
        heartbeatInterval: 30000,
        connectionTimeout: 60000,
        messageRateLimit: 100
      }
    }

    // Test user
    testUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      roles: ['user'],
      attributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    // Test connection
    testConnection = new MockConnection(testUser)

    // Create engine
    engine = new SubscriptionEngine(
      mockDatabase as any,
      mockAuthEngine as any,
      mockAuditLogger as any,
      config
    )
  })

  afterEach(async () => {
    if (engine.isRunning()) {
      await engine.stop()
    }
  })

  describe('Engine Lifecycle', () => {
    it('should start and stop correctly', async () => {
      expect(engine.isRunning()).toBe(false)

      await engine.start()
      expect(engine.isRunning()).toBe(true)

      await engine.stop()
      expect(engine.isRunning()).toBe(false)
    })

    it('should not start if already running', async () => {
      await engine.start()
      expect(engine.isRunning()).toBe(true)

      // Should not throw and should remain running
      await engine.start()
      expect(engine.isRunning()).toBe(true)
    })

    it('should not stop if not running', async () => {
      expect(engine.isRunning()).toBe(false)

      // Should not throw
      await engine.stop()
      expect(engine.isRunning()).toBe(false)
    })
  })

  describe('Health and Metrics', () => {
    it('should provide health status', async () => {
      const health = await engine.checkHealth()

      expect(health).toHaveProperty('status')
      expect(health).toHaveProperty('uptime')
      expect(health).toHaveProperty('subscriptionCount')
      expect(health).toHaveProperty('connectionCount')
      expect(health).toHaveProperty('memoryUsage')
      expect(health).toHaveProperty('checks')

      expect(health.status).toBe('unhealthy') // Engine not started
      expect(health.uptime).toBe(0)
    })

    it('should provide metrics', async () => {
      const metrics = await engine.getMetrics()

      expect(metrics).toHaveProperty('subscriptionsCreated')
      expect(metrics).toHaveProperty('subscriptionsDestroyed')
      expect(metrics).toHaveProperty('messagesProcessed')
      expect(metrics).toHaveProperty('averageProcessingTime')
      expect(metrics).toHaveProperty('errors')
      expect(metrics).toHaveProperty('timeouts')

      expect(metrics.subscriptionsCreated).toBe(0)
      expect(metrics.subscriptionsDestroyed).toBe(0)
      expect(metrics.messagesProcessed).toBe(0)
    })

    it('should show healthy status when running', async () => {
      await engine.start()

      // Wait a tiny bit to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 1))

      const health = await engine.checkHealth()
      expect(health.status).toBe('healthy')
      expect(health.uptime).toBeGreaterThan(0)
    })
  })

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await engine.start()
    })

    it('should create a subscription successfully', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users',
        includeInitialData: false
      }

      const subscription = await engine.subscribe(testUser, query, testConnection)

      expect(subscription).toHaveProperty('id')
      expect(subscription).toHaveProperty('userId', testUser.id)
      expect(subscription).toHaveProperty('status', 'active')
      expect(subscription).toHaveProperty('createdAt')
      expect(subscription).toHaveProperty('lastActivity')

      // Check that subscription is indexed
      const userSubs = await engine.getUserSubscriptions(testUser.id)
      expect(userSubs).toHaveLength(1)
      expect(userSubs[0].id).toBe(subscription.id)
    })

    it('should fail to create subscription when engine is not running', async () => {
      await engine.stop()

      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      await expect(
        engine.subscribe(testUser, query, testConnection)
      ).rejects.toThrow('Subscription engine is not running')
    })

    it('should unsubscribe successfully', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      const subscription = await engine.subscribe(testUser, query, testConnection)
      expect(subscription.status).toBe('active')

      await engine.unsubscribe(subscription.id)

      // Subscription should be removed
      const retrievedSub = await engine.getSubscription(subscription.id)
      expect(retrievedSub).toBeUndefined()

      // User should have no subscriptions
      const userSubs = await engine.getUserSubscriptions(testUser.id)
      expect(userSubs).toHaveLength(0)
    })

    it('should fail to unsubscribe non-existent subscription', async () => {
      await expect(
        engine.unsubscribe('non-existent-id')
      ).rejects.toThrow('Subscription not found')
    })

    it('should get all subscriptions', async () => {
      const query1: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }
      const query2: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'posts'
      }

      await engine.subscribe(testUser, query1, testConnection)
      await engine.subscribe(testUser, query2, testConnection)

      const allSubs = await engine.getAllSubscriptions()
      expect(allSubs).toHaveLength(2)
    })
  })

  describe('Subscription Lifecycle', () => {
    let subscriptionId: string

    beforeEach(async () => {
      await engine.start()

      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      const subscription = await engine.subscribe(testUser, query, testConnection)
      subscriptionId = subscription.id
    })

    it('should pause and resume subscription', async () => {
      await engine.pauseSubscription(subscriptionId)

      const subscription = await engine.getSubscription(subscriptionId)
      expect(subscription?.status).toBe('paused')

      await engine.resumeSubscription(subscriptionId)

      const resumedSubscription = await engine.getSubscription(subscriptionId)
      expect(resumedSubscription?.status).toBe('active')
    })

    it('should update subscription query', async () => {
      const newQuery: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'posts',
        includeInitialData: true
      }

      const updatedSubscription = await engine.updateSubscription(subscriptionId, newQuery)

      expect(updatedSubscription.query.options.includeInitialData).toBe(true)
    })
  })

  describe('Connection Management', () => {
    beforeEach(async () => {
      await engine.start()
    })

    it('should handle connection close', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      const subscription = await engine.subscribe(testUser, query, testConnection)
      expect(subscription.status).toBe('active')

      // Simulate connection close
      await engine.handleConnectionClose(testConnection.id)

      // Subscription should be cleaned up
      const retrievedSub = await engine.getSubscription(subscription.id)
      expect(retrievedSub).toBeUndefined()
    })

    it('should update connection activity', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      const subscription = await engine.subscribe(testUser, query, testConnection)
      const originalActivity = subscription.lastActivity

      // Wait a bit and update activity
      await new Promise(resolve => setTimeout(resolve, 10))
      await engine.updateConnectionActivity(testConnection.id)

      const updatedSubscription = await engine.getSubscription(subscription.id)
      expect(updatedSubscription?.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime())
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      await engine.start()
    })

    it('should provide subscription statistics', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      await engine.subscribe(testUser, query, testConnection)

      const stats = await engine.getStats()
      expect(stats.totalSubscriptions).toBe(1)
      expect(stats.activeSubscriptions).toBe(1)
      expect(stats.subscriptionsByUser.get(testUser.id)).toBe(1)
    })

    it('should track subscriptions by user', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      await engine.subscribe(testUser, query, testConnection)
      await engine.subscribe(testUser, query, testConnection)

      const subscriptionsByUser = await engine.getSubscriptionsByUser()
      expect(subscriptionsByUser.get(testUser.id)).toBe(2)
    })

    it('should track subscriptions by collection', async () => {
      const subscriptionsByCollection = await engine.getSubscriptionsByCollection()
      expect(subscriptionsByCollection).toBeInstanceOf(Map)
    })
  })

  describe('Performance', () => {
    beforeEach(async () => {
      await engine.start()
    })

    it('should create subscriptions quickly', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      const startTime = performance.now()
      await engine.subscribe(testUser, query, testConnection)
      const endTime = performance.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(10) // Should be less than 10ms
    })

    it('should handle multiple subscriptions efficiently', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection',
        collection: 'users'
      }

      const startTime = performance.now()

      const promises: Promise<any>[] = []
      for (let i = 0; i < 10; i++) {
        const connection = new MockConnection(testUser)
        promises.push(engine.subscribe(testUser, query, connection))
      }

      await Promise.all(promises)
      const endTime = performance.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(100) // Should be less than 100ms for 10 subscriptions

      const stats = await engine.getStats()
      expect(stats.totalSubscriptions).toBe(10)
    })
  })
})