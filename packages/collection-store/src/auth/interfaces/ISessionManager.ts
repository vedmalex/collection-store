// Session Manager Interface for Collection Store Auth System
// Comprehensive session and token management

import { AuthContext } from './types'
import {
  Session,
  CreateSessionData,
  UpdateSessionData,
  SessionValidationResult,
  Token,
  CreateTokenData,
  TokenValidationResult,
  TokenType,
  JWTPayload,
  JWTOptions,
  SessionSecurityEvent,
  SecurityEventType,
  SessionPolicy,
  SessionStats,
  UserSessionActivity,
  SessionCleanupResult,
  SessionMaintenanceConfig
} from '../session/types'

// ============================================================================
// Core Session Management Interface
// ============================================================================

export interface ISessionManager {
  // ============================================================================
  // Session CRUD Operations
  // ============================================================================

  /**
   * Create a new session
   */
  createSession(sessionData: CreateSessionData, context: AuthContext): Promise<Session>

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): Promise<Session | null>

  /**
   * Update session
   */
  updateSession(sessionId: string, updates: UpdateSessionData, context: AuthContext): Promise<Session>

  /**
   * Delete session (logout)
   */
  deleteSession(sessionId: string, context: AuthContext): Promise<boolean>

  /**
   * Validate session
   */
  validateSession(sessionId: string, context: AuthContext): Promise<SessionValidationResult>

  /**
   * Refresh session (extend expiration)
   */
  refreshSession(sessionId: string, context: AuthContext): Promise<Session>

  /**
   * Get user sessions
   */
  getUserSessions(userId: string, includeInactive?: boolean): Promise<Session[]>

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(userId?: string): Promise<number>

  // ============================================================================
  // Session Security
  // ============================================================================

  /**
   * Terminate all user sessions
   */
  terminateAllUserSessions(userId: string, context: AuthContext, excludeSessionId?: string): Promise<number>

  /**
   * Terminate sessions by criteria
   */
  terminateSessionsByCriteria(criteria: {
    userId?: string
    deviceType?: string
    ipAddress?: string
    olderThan?: Date
    suspicious?: boolean
  }, context: AuthContext): Promise<number>

  /**
   * Check for suspicious activity
   */
  checkSuspiciousActivity(sessionId: string, context: AuthContext): Promise<{
    suspicious: boolean
    reasons: string[]
    riskScore: number
  }>

  /**
   * Log security event
   */
  logSecurityEvent(event: Omit<SessionSecurityEvent, 'timestamp'>): Promise<void>

  /**
   * Get security events
   */
  getSecurityEvents(filters: {
    sessionId?: string
    userId?: string
    type?: SecurityEventType
    severity?: string
    from?: Date
    to?: Date
    limit?: number
  }): Promise<SessionSecurityEvent[]>

  // ============================================================================
  // Token Management
  // ============================================================================

  /**
   * Create token
   */
  createToken(tokenData: CreateTokenData, context: AuthContext): Promise<Token>

  /**
   * Get token by ID
   */
  getTokenById(tokenId: string): Promise<Token | null>

  /**
   * Get token by value
   */
  getTokenByValue(tokenValue: string): Promise<Token | null>

  /**
   * Validate token
   */
  validateToken(tokenValue: string, context: AuthContext): Promise<TokenValidationResult>

  /**
   * Revoke token
   */
  revokeToken(tokenId: string, context: AuthContext): Promise<boolean>

  /**
   * Revoke all user tokens
   */
  revokeAllUserTokens(userId: string, tokenType?: TokenType, context?: AuthContext): Promise<number>

  /**
   * Get user tokens
   */
  getUserTokens(userId: string, tokenType?: TokenType, includeInactive?: boolean): Promise<Token[]>

  /**
   * Update token usage
   */
  updateTokenUsage(tokenId: string): Promise<void>

  // ============================================================================
  // JWT Operations
  // ============================================================================

  /**
   * Generate JWT token
   */
  generateJWT(payload: JWTPayload, options?: JWTOptions): Promise<string>

  /**
   * Verify JWT token
   */
  verifyJWT(token: string): Promise<JWTPayload | null>

  /**
   * Decode JWT token (without verification)
   */
  decodeJWT(token: string): Promise<{ header: any; payload: JWTPayload } | null>

  /**
   * Refresh JWT token
   */
  refreshJWT(refreshToken: string, context: AuthContext): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }>

  // ============================================================================
  // Session Policy Management
  // ============================================================================

  /**
   * Set session policy
   */
  setSessionPolicy(policy: SessionPolicy): Promise<void>

  /**
   * Get session policy
   */
  getSessionPolicy(): Promise<SessionPolicy>

  /**
   * Enforce session policy
   */
  enforceSessionPolicy(userId: string, context: AuthContext): Promise<{
    allowed: boolean
    reason?: string
    actionsRequired?: string[]
  }>

  // ============================================================================
  // Device Management
  // ============================================================================

  /**
   * Register device
   */
  registerDevice(userId: string, deviceInfo: any, context: AuthContext): Promise<string>

  /**
   * Get user devices
   */
  getUserDevices(userId: string): Promise<Array<{
    deviceId: string
    deviceInfo: any
    lastUsed: Date
    isActive: boolean
  }>>

  /**
   * Revoke device access
   */
  revokeDeviceAccess(userId: string, deviceId: string, context: AuthContext): Promise<boolean>

  /**
   * Trust device
   */
  trustDevice(userId: string, deviceId: string, context: AuthContext): Promise<boolean>

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Check rate limit
   */
  checkRateLimit(tokenId: string, action: string): Promise<{
    allowed: boolean
    remaining: number
    resetAt: Date
  }>

  /**
   * Update rate limit
   */
  updateRateLimit(tokenId: string, action: string): Promise<void>

  /**
   * Reset rate limit
   */
  resetRateLimit(tokenId: string): Promise<void>

  // ============================================================================
  // Analytics and Monitoring
  // ============================================================================

  /**
   * Get session statistics
   */
  getSessionStats(timeRange?: { from: Date; to: Date }): Promise<SessionStats>

  /**
   * Get user session activity
   */
  getUserSessionActivity(userId: string, timeRange?: { from: Date; to: Date }): Promise<UserSessionActivity>

  /**
   * Get concurrent sessions
   */
  getConcurrentSessions(timeRange?: { from: Date; to: Date }): Promise<Array<{
    timestamp: Date
    count: number
  }>>

  /**
   * Get session duration analytics
   */
  getSessionDurationAnalytics(timeRange?: { from: Date; to: Date }): Promise<{
    average: number
    median: number
    percentiles: Record<string, number>
    distribution: Array<{ range: string; count: number }>
  }>

  // ============================================================================
  // Cleanup and Maintenance
  // ============================================================================

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): Promise<SessionCleanupResult>

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions(inactiveThreshold: number): Promise<SessionCleanupResult>

  /**
   * Set maintenance configuration
   */
  setMaintenanceConfig(config: SessionMaintenanceConfig): Promise<void>

  /**
   * Get maintenance configuration
   */
  getMaintenanceConfig(): Promise<SessionMaintenanceConfig>

  /**
   * Run maintenance tasks
   */
  runMaintenance(): Promise<SessionCleanupResult>

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export sessions data
   */
  exportSessions(options?: {
    userId?: string
    includeInactive?: boolean
    includeTokens?: boolean
    format?: 'json' | 'csv'
    timeRange?: { from: Date; to: Date }
  }): Promise<string>

  /**
   * Import sessions data
   */
  importSessions(data: string, options?: {
    overwriteExisting?: boolean
    validateOnly?: boolean
    format?: 'json' | 'csv'
  }, context?: AuthContext): Promise<{
    imported: number
    skipped: number
    errors: Array<{ session: string; error: string }>
  }>

  // ============================================================================
  // Health and Diagnostics
  // ============================================================================

  /**
   * Health check
   */
  healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    metrics: {
      activeSessions: number
      expiredSessions: number
      tokensIssued: number
      securityEvents: number
    }
  }>

  /**
   * Get diagnostics
   */
  getDiagnostics(): Promise<{
    sessionCount: number
    tokenCount: number
    averageSessionDuration: number
    securityEventCount: number
    memoryUsage: number
    cacheHitRate: number
  }>
}