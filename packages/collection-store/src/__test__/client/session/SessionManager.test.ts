/**
 * Phase 5: Client Integration - Session Manager Tests
 *
 * Тесты для SessionManager
 */

import { SessionManager } from '../../../client/session/core/SessionManager'
import { SessionConfig, SessionState } from '../../../client/session/interfaces/types'

describe('SessionManager', () => {
  let sessionManager: SessionManager

  beforeEach(() => {
    sessionManager = new SessionManager()
  })

  afterEach(async () => {
    await sessionManager.shutdown()
  })

  describe('createSession', () => {
    it('should create a new session with valid config', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      expect(session).toBeDefined()
      expect(session.sessionId).toBeDefined()
      expect(session.state).toBe('active')
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.lastActiveAt).toBeInstanceOf(Date)
      expect(session.expiresAt).toBeInstanceOf(Date)
      expect(session.connectionState).toBe('disconnected')
    })

    it('should create session with custom sessionId', async () => {
      const config: SessionConfig = {
        sessionId: 'custom-session-123',
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      expect(session.sessionId).toBe('custom-session-123')
    })

    it('should create session with userId', async () => {
      const config: SessionConfig = {
        userId: 'user-456',
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      expect(session.userId).toBe('user-456')
    })

    it('should validate session config', async () => {
      const invalidConfig: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 500, // Too small
        sessionTimeout: 30000, // Too small
        persistState: true,
        encryptState: false
      }

      await expect(sessionManager.createSession(invalidConfig)).rejects.toThrow()
    })

    it('should emit session_created event', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const eventPromise = new Promise((resolve) => {
        sessionManager.onSessionEvent((event) => {
          if (event.type === 'session_created') {
            resolve(event)
          }
        })
      })

      await sessionManager.createSession(config)
      const event = await eventPromise

      expect(event).toBeDefined()
    })
  })

  describe('getSession', () => {
    it('should return session info for existing session', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const createdSession = await sessionManager.createSession(config)
      const retrievedSession = await sessionManager.getSession(createdSession.sessionId)

      expect(retrievedSession).toBeDefined()
      expect(retrievedSession!.sessionId).toBe(createdSession.sessionId)
      expect(retrievedSession!.state).toBe('active')
    })

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent-session')
      expect(session).toBeNull()
    })

    it('should return null for expired session', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 60000, // Minimum valid timeout
        persistState: true,
        encryptState: false
      }

            const createdSession = await sessionManager.createSession(config)

      // Manually expire the session by setting expiresAt to past
      await sessionManager.updateSession(createdSession.sessionId, {
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      })

      const retrievedSession = await sessionManager.getSession(createdSession.sessionId)
      expect(retrievedSession).toBeNull()
    })
  })

  describe('updateSession', () => {
    it('should update session info', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const updates = {
        connectionState: 'connected' as const,
        metadata: { test: 'value' }
      }

      const updatedSession = await sessionManager.updateSession(session.sessionId, updates)

      expect(updatedSession.connectionState).toBe('connected')
      expect(updatedSession.metadata.test).toBe('value')
      expect(updatedSession.lastActiveAt.getTime()).toBeGreaterThan(session.lastActiveAt.getTime())
    })

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.updateSession('non-existent', { connectionState: 'connected' })
      ).rejects.toThrow('Session non-existent not found')
    })

    it('should emit session_updated event', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      const eventPromise = new Promise((resolve) => {
        sessionManager.onSessionEvent((event) => {
          if (event.type === 'session_updated') {
            resolve(event)
          }
        })
      })

      await sessionManager.updateSession(session.sessionId, { connectionState: 'connected' })
      const event = await eventPromise

      expect(event).toBeDefined()
    })
  })

  describe('terminateSession', () => {
    it('should terminate existing session', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)
      await sessionManager.terminateSession(session.sessionId)

      const retrievedSession = await sessionManager.getSession(session.sessionId)
      expect(retrievedSession).toBeNull()
    })

    it('should not throw error for non-existent session', async () => {
      // terminateSession should not throw for non-existent sessions
      await sessionManager.terminateSession('non-existent')
      // If we reach here, no error was thrown
      expect(true).toBe(true)
    })

    it('should emit session_terminated event', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      const eventPromise = new Promise((resolve) => {
        sessionManager.onSessionEvent((event) => {
          if (event.type === 'session_terminated') {
            resolve(event)
          }
        })
      })

      await sessionManager.terminateSession(session.sessionId)
      const event = await eventPromise

      expect(event).toBeDefined()
    })
  })

  describe('recoverSession', () => {
    it('should recover suspended session', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)
      await (sessionManager as any).suspendSession(session.sessionId)

      const recoveryOptions = {
        restoreState: true,
        restoreSubscriptions: true,
        restoreCache: true,
        validateSession: true,
        maxAge: 3600000
      }

      const result = await sessionManager.recoverSession(session.sessionId, recoveryOptions)

      expect(result.success).toBe(true)
      expect(result.sessionRestored).toBe(true)
      expect(result.stateRestored).toBe(true)
      expect(result.subscriptionsRestored).toBeGreaterThan(0)
      expect(result.cacheRestored).toBe(true)
    })

    it('should fail to recover non-existent session', async () => {
      const recoveryOptions = {
        restoreState: true,
        restoreSubscriptions: true,
        restoreCache: true,
        validateSession: true,
        maxAge: 3600000
      }

      const result = await sessionManager.recoverSession('non-existent', recoveryOptions)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.warnings).toContain('Session not found')
    })
  })

  describe('getActiveSessions', () => {
    it('should return only active sessions', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session1 = await sessionManager.createSession(config)
      const session2 = await sessionManager.createSession(config)
      const session3 = await sessionManager.createSession(config)

      // Terminate one session
      await sessionManager.terminateSession(session2.sessionId)

      const activeSessions = await sessionManager.getActiveSessions()

      expect(activeSessions).toHaveLength(2)
      expect(activeSessions.map(s => s.sessionId)).toContain(session1.sessionId)
      expect(activeSessions.map(s => s.sessionId)).toContain(session3.sessionId)
      expect(activeSessions.map(s => s.sessionId)).not.toContain(session2.sessionId)
    })

    it('should return empty array when no active sessions', async () => {
      const activeSessions = await sessionManager.getActiveSessions()
      expect(activeSessions).toHaveLength(0)
    })
  })

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 60000, // Minimum valid timeout
        persistState: true,
        encryptState: false
      }

      const session1 = await sessionManager.createSession(config)
      const session2 = await sessionManager.createSession(config)

      // Manually expire the sessions by setting expiresAt to past
      await sessionManager.updateSession(session1.sessionId, {
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      })
      await sessionManager.updateSession(session2.sessionId, {
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      })

      const cleanedCount = await sessionManager.cleanupExpiredSessions()
      expect(cleanedCount).toBe(2)

      const activeSessions = await sessionManager.getActiveSessions()
      expect(activeSessions).toHaveLength(0)
    })
  })

  describe('getSessionMetrics', () => {
    it('should return session metrics', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      // Wait a bit to have some duration
      await new Promise(resolve => setTimeout(resolve, 50))

      const metrics = await sessionManager.getSessionMetrics(session.sessionId)

      expect(metrics).toBeDefined()
      expect(metrics.sessionDuration).toBeGreaterThan(0)
      expect(metrics.connectionUptime).toBeGreaterThanOrEqual(0)
      expect(metrics.reconnectCount).toBe(0)
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0)
      expect(metrics.dataTransferred).toBeGreaterThanOrEqual(0)
      expect(metrics.errorsCount).toBe(0)
    })

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.getSessionMetrics('non-existent')
      ).rejects.toThrow('Session non-existent not found')
    })
  })

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)
      const isValid = await sessionManager.validateSession(session.sessionId)

      expect(isValid).toBe(true)
    })

    it('should not validate non-existent session', async () => {
      const isValid = await sessionManager.validateSession('non-existent')
      expect(isValid).toBe(false)
    })

        it('should not validate expired session', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 60000, // Minimum valid timeout
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)

      // Manually expire the session by setting expiresAt to past
      await sessionManager.updateSession(session.sessionId, {
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      })

      const isValid = await sessionManager.validateSession(session.sessionId)
      expect(isValid).toBe(false)
    })
  })

  describe('updateActivity', () => {
    it('should update session activity', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)
      const originalLastActive = session.lastActiveAt

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50))

      await (sessionManager as any).updateActivity(session.sessionId)
      const updatedSession = await sessionManager.getSession(session.sessionId)

      expect(updatedSession!.lastActiveAt.getTime()).toBeGreaterThan(originalLastActive.getTime())
    })
  })

  describe('event handling', () => {
    it('should handle session events', async () => {
      const events: any[] = []

      const unsubscribe = sessionManager.onSessionEvent((event) => {
        events.push(event)
      })

      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      const session = await sessionManager.createSession(config)
      await sessionManager.updateSession(session.sessionId, { connectionState: 'connected' })
      await sessionManager.terminateSession(session.sessionId)

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('session_created')
      expect(events[1].type).toBe('session_updated')
      expect(events[2].type).toBe('session_terminated')

      unsubscribe()
    })

    it('should unsubscribe from events', async () => {
      const events: any[] = []

      const unsubscribe = sessionManager.onSessionEvent((event) => {
        events.push(event)
      })

      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      await sessionManager.createSession(config)
      unsubscribe()
      await sessionManager.createSession(config)

      expect(events).toHaveLength(1) // Only first session creation
    })
  })

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      const config: SessionConfig = {
        connectionType: 'websocket',
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        sessionTimeout: 3600000,
        persistState: true,
        encryptState: false
      }

      await sessionManager.createSession(config)
      await sessionManager.createSession(config)

      await sessionManager.shutdown()

      const activeSessions = await sessionManager.getActiveSessions()
      expect(activeSessions).toHaveLength(0)
    })
  })
})