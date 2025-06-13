// SessionManager Tests for Collection Store Auth System
// Testing session management functionality

import { describe, test, expect, beforeEach } from 'bun:test'
import { CSDatabase } from '../../'
import { SessionManager } from '../core/SessionManager'
import { AuthContext } from '../interfaces/types'
import { CreateSessionData, SessionPolicy } from '../session/types'

describe('SessionManager', () => {
  let database: CSDatabase
  let sessionManager: SessionManager
  let testContext: AuthContext

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new CSDatabase(':memory:')
    await database.connect()

    sessionManager = new SessionManager(database)

    // Set test-friendly session policy
    await sessionManager.setSessionPolicy({
      maxConcurrentSessions: 5,
      sessionTimeout: 24 * 60 * 60, // 24 hours
      idleTimeout: 2 * 60 * 60, // 2 hours
      requireSecureConnection: false, // Allow non-secure connections for testing
      allowMultipleDevices: true,
      enforceGeoRestrictions: false,
      requireMFAForElevated: false,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 // 15 minutes
    })

    testContext = {
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now(),
      requestId: 'test-request',
      customAttributes: { userId: 'test-user' }
    }
  })

  describe('Session CRUD Operations', () => {
    test('should create a new session', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        deviceId: 'device456',
        deviceInfo: {
          type: 'desktop',
          os: 'Windows',
          browser: 'Chrome'
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        expiresIn: 3600, // 1 hour
        metadata: { loginMethod: 'password' }
      }

      const session = await sessionManager.createSession(sessionData, testContext)

      expect(session.id).toBeTruthy()
      expect(session.userId).toBe('user123')
      expect(session.deviceId).toBe('device456')
      expect(session.ipAddress).toBe('192.168.1.100')
      expect(session.isActive).toBe(true)
      expect(session.deviceInfo?.type).toBe('desktop')
      expect(session.metadata?.loginMethod).toBe('password')
      expect(session.securityFlags?.isSecure).toBeDefined()
    })

    test('should get session by ID', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent'
      }

      const createdSession = await sessionManager.createSession(sessionData, testContext)
      const retrievedSession = await sessionManager.getSessionById(createdSession.id)

      expect(retrievedSession).toBeTruthy()
      expect(retrievedSession?.id).toBe(createdSession.id)
      expect(retrievedSession?.userId).toBe('user123')
    })

    test('should return null for non-existent session', async () => {
      const session = await sessionManager.getSessionById('non-existent-id')
      expect(session).toBeNull()
    })

    test('should update session', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent'
      }

      const session = await sessionManager.createSession(sessionData, testContext)
      const updateTime = new Date()

      const updatedSession = await sessionManager.updateSession(session.id, {
        lastAccessedAt: updateTime,
        metadata: { updated: true }
      }, testContext)

      expect(updatedSession.lastAccessedAt.getTime()).toBe(updateTime.getTime())
      expect(updatedSession.metadata?.updated).toBe(true)
    })

    test('should delete session', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent'
      }

      const session = await sessionManager.createSession(sessionData, testContext)
      const deleted = await sessionManager.deleteSession(session.id, testContext)

      expect(deleted).toBe(true)

      // Session should still exist but be marked as deleted in metadata
      const retrievedSession = await sessionManager.getSessionById(session.id)
      expect(retrievedSession).toBeTruthy()
      expect(retrievedSession?.metadata?.deletedAt).toBeDefined()
    })
  })

  describe('Session Validation', () => {
    test('should validate active session', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent',
        expiresIn: 3600 // 1 hour
      }

      const session = await sessionManager.createSession(sessionData, testContext)
      const validation = await sessionManager.validateSession(session.id, testContext)

      expect(validation.valid).toBe(true)
      expect(validation.session).toBeTruthy()
      expect(validation.session?.id).toBe(session.id)
    })

    test('should reject non-existent session', async () => {
      const validation = await sessionManager.validateSession('non-existent', testContext)

      expect(validation.valid).toBe(false)
      expect(validation.reason).toBe('Session not found')
    })

    test('should reject expired session', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent',
        expiresIn: -1 // Already expired
      }

      const session = await sessionManager.createSession(sessionData, testContext)
      const validation = await sessionManager.validateSession(session.id, testContext)

      expect(validation.valid).toBe(false)
      expect(validation.reason).toBe('Session expired')
      expect(validation.requiresRefresh).toBe(true)
    })

    test('should refresh session', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent',
        expiresIn: 3600
      }

      const session = await sessionManager.createSession(sessionData, testContext)
      const originalExpiresAt = session.expiresAt

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      const refreshedSession = await sessionManager.refreshSession(session.id, testContext)

      expect(refreshedSession.expiresAt.getTime()).toBeGreaterThan(originalExpiresAt.getTime())
      expect(refreshedSession.lastAccessedAt.getTime()).toBeGreaterThan(session.lastAccessedAt.getTime())
    })
  })

  describe('User Sessions Management', () => {
    test('should get user sessions', async () => {
      const userId = 'user123'

      // Create multiple sessions for the user
      for (let i = 0; i < 3; i++) {
        await sessionManager.createSession({
          userId,
          ipAddress: `192.168.1.${100 + i}`,
          userAgent: `test-agent-${i}`
        }, testContext)
      }

      const sessions = await sessionManager.getUserSessions(userId)
      expect(sessions).toHaveLength(3)
      expect(sessions.every(s => s.userId === userId)).toBe(true)
    })

    test('should get active sessions count', async () => {
      const userId = 'user123'

      // Create sessions
      await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent-1'
      }, testContext)

      await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent-2'
      }, testContext)

      const count = await sessionManager.getActiveSessionsCount(userId)
      expect(count).toBe(2)

      const totalCount = await sessionManager.getActiveSessionsCount()
      expect(totalCount).toBeGreaterThanOrEqual(2)
    })

    test('should terminate all user sessions', async () => {
      const userId = 'user123'

      // Create multiple sessions
      const session1 = await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent-1'
      }, testContext)

      const session2 = await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent-2'
      }, testContext)

      const terminatedCount = await sessionManager.terminateAllUserSessions(userId, testContext)
      expect(terminatedCount).toBe(2)

      // Sessions should be marked as deleted
      const session1After = await sessionManager.getSessionById(session1.id)
      const session2After = await sessionManager.getSessionById(session2.id)

      expect(session1After?.metadata?.deletedAt).toBeDefined()
      expect(session2After?.metadata?.deletedAt).toBeDefined()
    })

    test('should terminate sessions except excluded one', async () => {
      const userId = 'user123'

      const session1 = await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent-1'
      }, testContext)

      const session2 = await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent-2'
      }, testContext)

      const terminatedCount = await sessionManager.terminateAllUserSessions(
        userId,
        testContext,
        session1.id // Exclude this session
      )

      expect(terminatedCount).toBe(1)

      // Only session2 should be terminated
      const session1After = await sessionManager.getSessionById(session1.id)
      const session2After = await sessionManager.getSessionById(session2.id)

      expect(session1After?.metadata?.deletedAt).toBeUndefined()
      expect(session2After?.metadata?.deletedAt).toBeDefined()
    })
  })

  describe('Session Security', () => {
    test('should check suspicious activity', async () => {
      const sessionData: CreateSessionData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent'
      }

      const session = await sessionManager.createSession(sessionData, testContext)

      // Check with different IP (suspicious)
      const suspiciousContext = {
        ...testContext,
        ip: '10.0.0.1' // Different IP
      }

      const suspiciousCheck = await sessionManager.checkSuspiciousActivity(session.id, suspiciousContext)

      expect(suspiciousCheck.reasons).toContain('IP address changed during session')
      expect(suspiciousCheck.riskScore).toBeGreaterThan(0)
    })

    test('should log security events', async () => {
      await sessionManager.logSecurityEvent({
        sessionId: 'session123',
        userId: 'user123',
        type: 'login_success',
        severity: 'low',
        description: 'Test security event',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent'
      })

      const events = await sessionManager.getSecurityEvents({
        sessionId: 'session123',
        limit: 10
      })

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('login_success')
      expect(events[0].description).toBe('Test security event')
    })

                test('should filter security events', async () => {
      const testId = Date.now().toString()

      // Log multiple events with unique IDs
      await sessionManager.logSecurityEvent({
        sessionId: `session1_${testId}`,
        userId: `user123_${testId}`,
        type: 'login_success',
        severity: 'low',
        description: 'Login event',
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent'
      })

      await sessionManager.logSecurityEvent({
        sessionId: `session2_${testId}`,
        userId: `user456_${testId}`,
        type: 'login_failure',
        severity: 'medium',
        description: 'Failed login',
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent'
      })

      // Filter by user
      const userEvents = await sessionManager.getSecurityEvents({
        userId: `user123_${testId}`
      })
      expect(userEvents).toHaveLength(1)
      expect(userEvents[0].userId).toBe(`user123_${testId}`)

      // Filter by type
      const loginEvents = await sessionManager.getSecurityEvents({
        type: 'login_failure'
      })
      expect(loginEvents.length).toBeGreaterThanOrEqual(1)
      expect(loginEvents.some(e => e.type === 'login_failure')).toBe(true)
    })
  })

  describe('Session Policy', () => {
    test('should set and get session policy', async () => {
      const newPolicy: SessionPolicy = {
        maxConcurrentSessions: 3,
        sessionTimeout: 7200, // 2 hours
        idleTimeout: 1800, // 30 minutes
        requireSecureConnection: false,
        allowMultipleDevices: true,
        enforceGeoRestrictions: true,
        allowedCountries: ['US', 'CA'],
        requireMFAForElevated: true,
        maxFailedAttempts: 3,
        lockoutDuration: 900 // 15 minutes
      }

      await sessionManager.setSessionPolicy(newPolicy)
      const retrievedPolicy = await sessionManager.getSessionPolicy()

      expect(retrievedPolicy.maxConcurrentSessions).toBe(3)
      expect(retrievedPolicy.sessionTimeout).toBe(7200)
      expect(retrievedPolicy.allowedCountries).toEqual(['US', 'CA'])
    })

    test('should enforce concurrent sessions limit', async () => {
      // Set policy with limit of 2 sessions
      await sessionManager.setSessionPolicy({
        maxConcurrentSessions: 2,
        sessionTimeout: 3600,
        idleTimeout: 1800,
        requireSecureConnection: false,
        allowMultipleDevices: true,
        enforceGeoRestrictions: false,
        requireMFAForElevated: false,
        maxFailedAttempts: 5,
        lockoutDuration: 900
      })

      const userId = 'user123'

      // Create 2 sessions (should work)
      await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent-1'
      }, testContext)

      await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent-2'
      }, testContext)

      // Third session should be rejected
      await expect(sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.102',
        userAgent: 'test-agent-3'
      }, testContext)).rejects.toThrow('Maximum concurrent sessions limit reached')
    })

    test('should enforce session policy', async () => {
      const userId = 'user123'

      const policyCheck = await sessionManager.enforceSessionPolicy(userId, testContext)
      expect(policyCheck.allowed).toBe(true)

      // Create sessions up to the limit
      const policy = await sessionManager.getSessionPolicy()
      for (let i = 0; i < policy.maxConcurrentSessions; i++) {
        await sessionManager.createSession({
          userId,
          ipAddress: `192.168.1.${100 + i}`,
          userAgent: `test-agent-${i}`
        }, testContext)
      }

      // Now policy should deny new sessions
      const policyCheckAfter = await sessionManager.enforceSessionPolicy(userId, testContext)
      expect(policyCheckAfter.allowed).toBe(false)
      expect(policyCheckAfter.reason).toContain('Maximum concurrent sessions limit reached')
    })
  })

  describe('Session Termination by Criteria', () => {
    test('should terminate sessions by IP address', async () => {
      const userId = 'user123'
      const targetIP = '192.168.1.100'

      // Create sessions with different IPs
      await sessionManager.createSession({
        userId,
        ipAddress: targetIP,
        userAgent: 'test-agent-1'
      }, testContext)

      await sessionManager.createSession({
        userId,
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent-2'
      }, testContext)

      const terminatedCount = await sessionManager.terminateSessionsByCriteria({
        ipAddress: targetIP
      }, testContext)

      expect(terminatedCount).toBe(1)
    })

    test('should terminate sessions by device type', async () => {
      const userId = 'user123'

      await sessionManager.createSession({
        userId,
        deviceInfo: { type: 'mobile' },
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent-1'
      }, testContext)

      await sessionManager.createSession({
        userId,
        deviceInfo: { type: 'desktop' },
        ipAddress: '192.168.1.101',
        userAgent: 'test-agent-2'
      }, testContext)

      const terminatedCount = await sessionManager.terminateSessionsByCriteria({
        deviceType: 'mobile'
      }, testContext)

      expect(terminatedCount).toBe(1)
    })
  })
})