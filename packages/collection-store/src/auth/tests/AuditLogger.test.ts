// AuditLogger Tests for Collection Store Auth System
// Testing audit logging and monitoring functionality

import { describe, test, expect, beforeEach } from 'bun:test'
import { CSDatabase } from '../../'
import { AuditLogger } from '../core/AuditLogger'
import { AuthContext } from '../interfaces/types'

describe('AuditLogger', () => {
  let database: CSDatabase
  let auditLogger: AuditLogger
  let testContext: AuthContext

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new CSDatabase(':memory:')
    await database.connect()

    auditLogger = new AuditLogger(database)

    testContext = {
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now(),
      requestId: 'test-request-123',
      customAttributes: { testMode: true }
    }
  })

  describe('Core Logging Operations', () => {
    test('should log authentication events', async () => {
      await auditLogger.logAuthentication(
        'user123',
        'login_success',
        'success',
        testContext,
        { method: 'password' }
      )

      // Flush batch to ensure logs are saved
      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        userId: 'user123',
        action: 'auth.login.success'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].userId).toBe('user123')
      expect(logs.logs[0].action).toBe('auth.login.success')
      expect(logs.logs[0].category).toBe('authentication')
      expect(logs.logs[0].outcome).toBe('success')
      expect(logs.logs[0].context.ipAddress).toBe('127.0.0.1')
    })

    test('should log authorization events', async () => {
      await auditLogger.logAuthorization(
        'user123',
        'user-profile',
        'read',
        'success',
        testContext,
        { permissions: ['read'] }
      )

      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        userId: 'user123',
        category: 'authorization'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].resource).toBe('user-profile')
      expect(logs.logs[0].category).toBe('authorization')
    })

    test('should log user management events', async () => {
      await auditLogger.logUserManagement(
        'admin123',
        'user456',
        'user_create',
        'success',
        testContext,
        { email: 'test@example.com' }
      )

      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        userId: 'admin123',
        category: 'user_management'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].action).toBe('user.create')
      expect(logs.logs[0].resourceId).toBe('user456')
      expect(logs.logs[0].details.additionalInfo?.targetUserId).toBe('user456')
    })

    test('should log role management events', async () => {
      await auditLogger.logRoleManagement(
        'admin123',
        'role456',
        'role_create',
        'success',
        testContext,
        { permissions: ['read', 'write'] }
      )

      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        userId: 'admin123',
        category: 'role_management'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].action).toBe('role.create')
      expect(logs.logs[0].resourceId).toBe('role456')
      expect(logs.logs[0].details.additionalInfo?.roleId).toBe('role456')
    })

    test('should log session events', async () => {
      await auditLogger.logSession(
        'user123',
        'session456',
        'session_start',
        testContext,
        { deviceType: 'desktop' }
      )

      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        sessionId: 'session456',
        category: 'session_management'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].action).toBe('auth.session.create')
      expect(logs.logs[0].sessionId).toBe('session456')
    })

    test('should log security events', async () => {
      await auditLogger.logSecurity(
        'user123',
        'brute_force_detected',
        'high',
        testContext,
        { attempts: 5, timeWindow: '5min' }
      )

      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        userId: 'user123',
        category: 'security'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].action).toBe('security.brute.force')
      expect(logs.logs[0].severity).toBe('high')
    })

    test('should log generic events', async () => {
      await auditLogger.logEvent(
        'user123',
        'system.backup.create',
        'backup',
        'success',
        testContext,
        { backupSize: '100MB' }
      )

      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({
        userId: 'user123',
        resource: 'backup'
      })

      expect(logs.total).toBe(1)
      expect(logs.logs[0].action).toBe('system.backup.create')
      expect(logs.logs[0].outcome).toBe('success')
    })
  })

  describe('Batch Operations', () => {
    test('should handle batch logging', async () => {
      const events = [
        {
          id: 'audit_1',
          timestamp: new Date(),
          userId: 'user1',
          action: 'auth.login.success',
          category: 'authentication',
          severity: 'info',
          resource: 'authentication',
          outcome: 'success',
          details: { description: 'Login successful' },
          context: { ipAddress: '127.0.0.1', userAgent: 'test', source: 'test' }
        },
        {
          id: 'audit_2',
          timestamp: new Date(),
          userId: 'user2',
          action: 'user.create',
          category: 'user_management',
          severity: 'info',
          resource: 'user',
          outcome: 'success',
          details: { description: 'User created' },
          context: { ipAddress: '127.0.0.1', userAgent: 'test', source: 'test' }
        }
      ]

      await auditLogger.logBatch(events)
      await auditLogger.flushBatch()

      const logs = await auditLogger.queryLogs({ limit: 10 })
      expect(logs.total).toBeGreaterThanOrEqual(2)
    })

    test('should handle batch logger interface', async () => {
      const batchLogger = auditLogger.startBatch()

      batchLogger.log({
        id: 'audit_batch_1',
        timestamp: new Date(),
        userId: 'user123',
        action: 'auth.logout',
        category: 'authentication',
        severity: 'info',
        resource: 'authentication',
        outcome: 'success',
        details: { description: 'User logged out' },
        context: { ipAddress: '127.0.0.1', userAgent: 'test', source: 'test' }
      })

      expect(batchLogger.size()).toBe(1)

      await batchLogger.flush()

      const logs = await auditLogger.queryLogs({
        action: 'auth.logout'
      })

      expect(logs.total).toBe(1)
    })

    test('should auto-flush when batch size is reached', async () => {
      // Update config to small batch size for testing
      await auditLogger.updateConfiguration({ batchSize: 2 })

      // Log 3 events (should trigger auto-flush after 2)
      await auditLogger.logEvent('user1', 'test.action1', 'test', 'success', testContext)
      await auditLogger.logEvent('user2', 'test.action2', 'test', 'success', testContext)
      await auditLogger.logEvent('user3', 'test.action3', 'test', 'success', testContext)

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 10))

      const logs = await auditLogger.queryLogs({ resource: 'test' })
      expect(logs.total).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create fresh database for each test to avoid data pollution
      database = new CSDatabase(':memory:')
      await database.connect()
      auditLogger = new AuditLogger(database)

      // Setup test data
      await auditLogger.logAuthentication('user1', 'login_success', 'success', testContext)
      await auditLogger.logAuthentication('user1', 'logout', 'success', testContext)
      await auditLogger.logAuthentication('user2', 'login_failure', 'failure', testContext)
      await auditLogger.logUserManagement('admin1', 'user3', 'user_create', 'success', testContext)
      await auditLogger.flushBatch()
    })

    test('should query logs by user ID', async () => {
      const logs = await auditLogger.queryLogs({ userId: 'user1' })
      expect(logs.total).toBe(2)
      expect(logs.logs.every(log => log.userId === 'user1')).toBe(true)
    })

    test('should query logs by action', async () => {
      const logs = await auditLogger.queryLogs({ action: 'auth.login.success' })
      expect(logs.total).toBe(1)
      expect(logs.logs[0].action).toBe('auth.login.success')
    })

    test('should query logs by multiple actions', async () => {
      const logs = await auditLogger.queryLogs({
        action: ['auth.login.success', 'auth.logout']
      })
      expect(logs.total).toBe(2)
    })

    test('should query logs by category', async () => {
      const logs = await auditLogger.queryLogs({ category: 'authentication' })
      expect(logs.total).toBe(3)
      expect(logs.logs.every(log => log.category === 'authentication')).toBe(true)
    })

    test('should query logs by result/outcome', async () => {
      const logs = await auditLogger.queryLogs({ result: 'failure' })
      expect(logs.total).toBe(1)
      expect(logs.logs[0].outcome).toBe('failure')
    })

    test('should handle pagination', async () => {
      const page1 = await auditLogger.queryLogs({ limit: 2, offset: 0 })
      expect(page1.logs.length).toBe(2)
      expect(page1.hasMore).toBe(true)

      const page2 = await auditLogger.queryLogs({ limit: 2, offset: 2 })
      expect(page2.logs.length).toBeGreaterThanOrEqual(1)
    })

    test('should sort logs', async () => {
      const logsDesc = await auditLogger.queryLogs({
        sortBy: 'timestamp',
        sortOrder: 'desc'
      })

      const logsAsc = await auditLogger.queryLogs({
        sortBy: 'timestamp',
        sortOrder: 'asc'
      })

      expect(logsDesc.logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        logsDesc.logs[logsDesc.logs.length - 1].timestamp.getTime()
      )

      expect(logsAsc.logs[0].timestamp.getTime()).toBeLessThanOrEqual(
        logsAsc.logs[logsAsc.logs.length - 1].timestamp.getTime()
      )
    })
  })

  describe('Specialized Query Methods', () => {
    beforeEach(async () => {
      // Create fresh database for each test to avoid data pollution
      database = new CSDatabase(':memory:')
      await database.connect()
      auditLogger = new AuditLogger(database)

      await auditLogger.logAuthentication('user1', 'login_success', 'success', testContext)
      await auditLogger.logAuthentication('user1', 'login_failure', 'failure', testContext)
      await auditLogger.logAuthorization('user1', 'document1', 'read', 'success', testContext)
      await auditLogger.logSecurity('user1', 'suspicious_login', 'medium', testContext)
      await auditLogger.flushBatch()
    })

    test('should get user activity', async () => {
      const activity = await auditLogger.getUserActivity('user1')
      expect(activity.length).toBe(4)
      expect(activity.every(log => log.userId === 'user1')).toBe(true)
    })

    test('should get resource access logs', async () => {
      const access = await auditLogger.getResourceAccess('document1')
      expect(access.length).toBe(1)
      expect(access[0].resource).toBe('document1')
    })

    test('should get failed attempts', async () => {
      const failures = await auditLogger.getFailedAttempts()
      expect(failures.length).toBe(1)
      expect(failures[0].outcome).toBe('failure')
    })

    test('should get security events', async () => {
      const securityEvents = await auditLogger.getSecurityEvents()
      expect(securityEvents.length).toBe(1)
      expect(securityEvents[0].category).toBe('security')
    })

    test('should filter security events by severity', async () => {
      // Create fresh database for this specific test
      const freshDatabase = new CSDatabase(':memory:')
      await freshDatabase.connect()
      const freshAuditLogger = new AuditLogger(freshDatabase)

      await freshAuditLogger.logSecurity('user2', 'brute_force_detected', 'high', testContext)
      await freshAuditLogger.flushBatch()

      const highSeverityEvents = await freshAuditLogger.getSecurityEvents('high')
      expect(highSeverityEvents.length).toBe(1)
      expect(highSeverityEvents[0].severity).toBe('high')
    })
  })

  describe('Analytics and Reporting', () => {
    beforeEach(async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      }

      // Create test data
      await auditLogger.logAuthentication('user1', 'login_success', 'success', testContext)
      await auditLogger.logAuthentication('user2', 'login_success', 'success', testContext)
      await auditLogger.logSecurity('user1', 'suspicious_login', 'medium', testContext)
      await auditLogger.flushBatch()
    })

    test('should generate activity summary', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      }

      const summary = await auditLogger.getActivitySummary(timeRange)

      expect(summary.timeRange).toEqual(timeRange)
      expect(summary.totalEvents).toBeGreaterThanOrEqual(3)
      expect(summary.uniqueUsers).toBeGreaterThanOrEqual(2)
    })

    test('should generate security report', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      }

      const report = await auditLogger.getSecurityReport(timeRange)

      expect(report.timeRange).toEqual(timeRange)
      expect(report.securityEvents).toBeGreaterThanOrEqual(1)
    })

    test('should get user behavior analytics', async () => {
      const analytics = await auditLogger.getUserBehaviorAnalytics('user1', 7)

      expect(analytics.userId).toBe('user1')
      expect(analytics.timeRange).toBeDefined()
      expect(analytics.loginPattern).toBeDefined()
      expect(analytics.accessPattern).toBeDefined()
      expect(analytics.riskScore).toBeDefined()
    })

    test('should get usage statistics', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      }

      const stats = await auditLogger.getUsageStatistics(timeRange)

      expect(stats.timeRange).toEqual(timeRange)
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Configuration and Monitoring', () => {
    test('should get and update configuration', async () => {
      const config = await auditLogger.getConfiguration()
      expect(config.enabled).toBe(true)
      expect(config.batchSize).toBeDefined()

      await auditLogger.updateConfiguration({
        batchSize: 50,
        logLevel: 'detailed'
      })

      const updatedConfig = await auditLogger.getConfiguration()
      expect(updatedConfig.batchSize).toBe(50)
    })

    test('should get statistics', async () => {
      // Add some logs first
      await auditLogger.logEvent('user1', 'test.action', 'test', 'success', testContext)
      await auditLogger.flushBatch()

      const stats = await auditLogger.getStatistics()

      expect(stats.totalLogsWritten).toBeGreaterThanOrEqual(1)
      expect(stats.logsPerSecond).toBeDefined()
      expect(stats.averageWriteTime).toBeDefined()
      expect(stats.activeSubscriptions).toBe(0)
    })

    test('should test logging functionality', async () => {
      const testResult = await auditLogger.testLogging()

      expect(testResult.success).toBe(true)
      expect(testResult.writeTest.success).toBe(true)
      expect(testResult.readTest.success).toBe(true)
      expect(testResult.batchTest.success).toBe(true)
      expect(testResult.writeTest.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Real-time Monitoring', () => {
    test('should handle subscriptions', async () => {
      let receivedEvent: any = null

      const subscriptionId = await auditLogger.subscribe(
        { userId: 'user123', category: 'authentication' },
        (event: any) => {
          receivedEvent = event
        }
      )

      expect(subscriptionId).toBeTruthy()

      // Log an event that should trigger the subscription
      await auditLogger.logAuthentication('user123', 'login_success', 'success', testContext)

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(receivedEvent).toBeTruthy()
      expect(receivedEvent.userId).toBe('user123')
      expect(receivedEvent.category).toBe('authentication')

      // Test unsubscribe
      await auditLogger.unsubscribe(subscriptionId)

      const subscriptions = await auditLogger.getSubscriptions()
      expect(subscriptions.length).toBe(0)
    })

    test('should filter subscription events correctly', async () => {
      let authEvents: any[] = []
      let securityEvents: any[] = []

      // Subscribe to authentication events
      await auditLogger.subscribe(
        { category: 'authentication' },
        (event: any) => authEvents.push(event)
      )

      // Subscribe to security events
      await auditLogger.subscribe(
        { category: 'security' },
        (event: any) => securityEvents.push(event)
      )

      // Log different types of events
      await auditLogger.logAuthentication('user1', 'login_success', 'success', testContext)
      await auditLogger.logSecurity('user1', 'suspicious_login', 'medium', testContext)
      await auditLogger.logUserManagement('admin1', 'user2', 'user_create', 'success', testContext)

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(authEvents.length).toBe(1)
      expect(authEvents[0].category).toBe('authentication')

      expect(securityEvents.length).toBe(1)
      expect(securityEvents[0].category).toBe('security')
    })

    test('should get active subscriptions', async () => {
      await auditLogger.subscribe(
        { userId: 'user1' },
        () => {}
      )

      await auditLogger.subscribe(
        { category: 'security' },
        () => {}
      )

      const subscriptions = await auditLogger.getSubscriptions()
      expect(subscriptions.length).toBe(2)
      expect(subscriptions.every(sub => sub.isActive)).toBe(true)
    })
  })

  describe('Time Range Filtering', () => {
    test('should filter logs by time range', async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

      // Log some events
      await auditLogger.logEvent('user1', 'old.event', 'test', 'success', testContext)
      await auditLogger.flushBatch()

      // Query with time range
      const logs = await auditLogger.queryLogs({
        timeRange: {
          start: oneHourAgo,
          end: now
        }
      })

      // All returned logs should be within the time range
      logs.logs.forEach(log => {
        expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime())
        expect(log.timestamp.getTime()).toBeLessThanOrEqual(now.getTime())
      })
    })
  })
})