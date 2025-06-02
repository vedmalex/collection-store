// Main Authentication Manager Interface for Collection Store Auth System
// Acts as a facade for all authentication and authorization operations

import { CSDatabase } from '../../CSDatabase'
import {
  User,
  AuthCredentials,
  AuthResult,
  AuthContext,
  TokenPair,
  TokenValidation,
  AuthConfig,
  ResourceDescriptor,
  AuthorizationResult,
  CreateUserData,
  UpdateUserData
} from './types'
import { IUserManager } from './IUserManager'
import { ITokenManager } from './ITokenManager'
import { IAuditLogger } from './IAuditLogger'

export interface IAuthManager {
  // ============================================================================
  // Initialization and Configuration
  // ============================================================================

  /**
   * Initialize auth manager with database and configuration
   */
  initialize(database: CSDatabase, config: AuthConfig): Promise<void>

  /**
   * Get current configuration
   */
  getConfiguration(): Promise<AuthConfig>

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<AuthConfig>): Promise<void>

  /**
   * Test auth system health
   */
  healthCheck(): Promise<HealthCheckResult>

  // ============================================================================
  // Authentication Operations
  // ============================================================================

  /**
   * Authenticate user with credentials
   */
  authenticate(credentials: AuthCredentials): Promise<AuthResult>

  /**
   * Validate authentication token
   */
  validateToken(token: string): Promise<TokenValidation>

  /**
   * Refresh authentication tokens
   */
  refreshToken(refreshToken: string): Promise<TokenPair>

  /**
   * Revoke authentication token
   */
  revokeToken(tokenId: string): Promise<void>

  /**
   * Logout user (revoke all tokens)
   */
  logout(userId: string, sessionId?: string): Promise<void>

  /**
   * Logout from all sessions
   */
  logoutFromAllSessions(userId: string): Promise<void>

  // ============================================================================
  // Authorization Operations
  // ============================================================================

  /**
   * Check if user has permission to access resource
   */
  checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): Promise<AuthorizationResult>

  /**
   * Check multiple permissions at once
   */
  checkPermissions(
    user: User,
    permissions: Array<{ resource: ResourceDescriptor; action: string }>,
    context?: AuthContext
  ): Promise<AuthorizationResult[]>

  /**
   * Get user effective permissions
   */
  getUserPermissions(userId: string): Promise<EffectivePermissions>

  /**
   * Check if user has specific role
   */
  hasRole(userId: string, roleId: string): Promise<boolean>

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(userId: string, roleIds: string[]): Promise<boolean>

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(userId: string, roleIds: string[]): Promise<boolean>

  // ============================================================================
  // User Management (Delegated to UserManager)
  // ============================================================================

  /**
   * Create new user
   */
  createUser(userData: CreateUserData, context?: AuthContext): Promise<User>

  /**
   * Get user by ID
   */
  getUser(userId: string): Promise<User | undefined>

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Promise<User | undefined>

  /**
   * Update user
   */
  updateUser(userId: string, updates: UpdateUserData, context?: AuthContext): Promise<User>

  /**
   * Change user password
   */
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context?: AuthContext
  ): Promise<void>

  /**
   * Reset user password (admin operation)
   */
  resetPassword(
    userId: string,
    newPassword: string,
    requireChange: boolean,
    context?: AuthContext
  ): Promise<void>

  /**
   * Deactivate user
   */
  deactivateUser(userId: string, context?: AuthContext): Promise<void>

  /**
   * Activate user
   */
  activateUser(userId: string, context?: AuthContext): Promise<void>

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Get active sessions for user
   */
  getUserSessions(userId: string): Promise<SessionInfo[]>

  /**
   * Terminate specific session
   */
  terminateSession(sessionId: string): Promise<void>

  /**
   * Terminate all user sessions except current
   */
  terminateOtherSessions(userId: string, currentSessionId: string): Promise<void>

  /**
   * Get session information
   */
  getSessionInfo(sessionId: string): Promise<SessionInfo | null>

  /**
   * Extend session expiration
   */
  extendSession(sessionId: string, extensionTime?: number): Promise<void>

  // ============================================================================
  // External Authentication Integration
  // ============================================================================

  /**
   * Configure external authentication provider
   */
  configureExternalAuth(config: ExternalAuthConfig): Promise<void>

  /**
   * Authenticate with external provider
   */
  authenticateExternal(
    providerId: string,
    externalToken: string,
    context?: AuthContext
  ): Promise<AuthResult>

  /**
   * Link external account to existing user
   */
  linkExternalAccount(
    userId: string,
    providerId: string,
    externalUserId: string
  ): Promise<void>

  /**
   * Unlink external account
   */
  unlinkExternalAccount(userId: string, providerId: string): Promise<void>

  /**
   * Get user's external accounts
   */
  getExternalAccounts(userId: string): Promise<ExternalAccount[]>

  // ============================================================================
  // Security Operations
  // ============================================================================

  /**
   * Lock user account
   */
  lockUser(userId: string, reason: string, context?: AuthContext): Promise<void>

  /**
   * Unlock user account
   */
  unlockUser(userId: string, context?: AuthContext): Promise<void>

  /**
   * Check if user is locked
   */
  isUserLocked(userId: string): Promise<boolean>

  /**
   * Get failed login attempts for user
   */
  getFailedLoginAttempts(userId: string): Promise<number>

  /**
   * Reset failed login attempts
   */
  resetFailedLoginAttempts(userId: string): Promise<void>

  /**
   * Check for suspicious activity
   */
  checkSuspiciousActivity(userId: string, context: AuthContext): Promise<SuspiciousActivityResult>

  // ============================================================================
  // Audit and Monitoring
  // ============================================================================

  /**
   * Get authentication statistics
   */
  getAuthStats(timeRange?: TimeRange): Promise<AuthStats>

  /**
   * Get user activity summary
   */
  getUserActivity(userId: string, days?: number): Promise<UserActivitySummary>

  /**
   * Get security events
   */
  getSecurityEvents(timeRange?: TimeRange): Promise<SecurityEvent[]>

  /**
   * Generate security report
   */
  generateSecurityReport(timeRange: TimeRange): Promise<SecurityReport>

  // ============================================================================
  // Component Access (for advanced usage)
  // ============================================================================

  /**
   * Get user manager instance
   */
  getUserManager(): IUserManager

  /**
   * Get token manager instance
   */
  getTokenManager(): ITokenManager

  /**
   * Get audit logger instance
   */
  getAuditLogger(): IAuditLogger

  // ============================================================================
  // Maintenance Operations
  // ============================================================================

  /**
   * Clean up expired tokens and sessions
   */
  cleanup(): Promise<CleanupResult>

  /**
   * Rotate encryption keys
   */
  rotateKeys(): Promise<void>

  /**
   * Backup auth data
   */
  backup(location: string): Promise<BackupResult>

  /**
   * Restore auth data from backup
   */
  restore(location: string): Promise<RestoreResult>

  /**
   * Validate auth system integrity
   */
  validateIntegrity(): Promise<IntegrityCheckResult>
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface HealthCheckResult {
  healthy: boolean
  components: {
    database: ComponentHealth
    userManager: ComponentHealth
    tokenManager: ComponentHealth
    auditLogger: ComponentHealth
  }
  performance: {
    authenticationTime: number // ms
    authorizationTime: number // ms
    tokenValidationTime: number // ms
  }
  errors: string[]
  warnings: string[]
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number // ms
  error?: string
  lastCheck: Date
}

export interface EffectivePermissions {
  userId: string
  roles: string[]
  permissions: Array<{
    resource: string
    actions: string[]
    scope?: string
    inherited?: boolean
  }>
  computedAt: Date
}

export interface SessionInfo {
  id: string
  userId: string
  createdAt: Date
  lastAccessAt: Date
  expiresAt: Date
  ipAddress: string
  userAgent: string
  isActive: boolean
  tokenCount: number
}

export interface ExternalAuthConfig {
  providerId: string
  enabled: boolean
  config: Record<string, any>
  userMapping: {
    email: string
    firstName?: string
    lastName?: string
    roles?: string[]
  }
}

export interface ExternalAccount {
  providerId: string
  externalUserId: string
  email?: string
  linkedAt: Date
  lastUsedAt?: Date
  isActive: boolean
}

export interface SuspiciousActivityResult {
  suspicious: boolean
  riskScore: number // 0-100
  reasons: string[]
  recommendedActions: string[]
  shouldBlock: boolean
}

export interface TimeRange {
  start: Date
  end: Date
}

export interface AuthStats {
  timeRange: TimeRange
  totalLogins: number
  successfulLogins: number
  failedLogins: number
  uniqueUsers: number
  newUsers: number
  tokensIssued: number
  tokensRevoked: number
  averageSessionDuration: number // minutes
  peakConcurrentUsers: number
  topFailureReasons: Array<{ reason: string; count: number }>
}

export interface UserActivitySummary {
  userId: string
  timeRange: TimeRange
  loginCount: number
  lastLogin: Date | null
  averageSessionDuration: number // minutes
  actionsPerformed: number
  resourcesAccessed: string[]
  failedAttempts: number
  suspiciousActivity: boolean
}

export interface SecurityEvent {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  description: string
  timestamp: Date
  context: AuthContext
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
}

export interface SecurityReport {
  timeRange: TimeRange
  summary: {
    totalEvents: number
    criticalEvents: number
    affectedUsers: number
    resolvedEvents: number
  }
  events: SecurityEvent[]
  trends: {
    eventsByDay: Record<string, number>
    eventsByType: Record<string, number>
    eventsBySeverity: Record<string, number>
  }
  recommendations: string[]
}

export interface CleanupResult {
  expiredTokens: number
  expiredSessions: number
  oldAuditLogs: number
  freedSpace: number // bytes
  errors: string[]
}

export interface BackupResult {
  success: boolean
  location: string
  size: number // bytes
  itemsBackedUp: {
    users: number
    roles: number
    sessions: number
    auditLogs: number
  }
  duration: number // ms
  error?: string
}

export interface RestoreResult {
  success: boolean
  itemsRestored: {
    users: number
    roles: number
    sessions: number
    auditLogs: number
  }
  duration: number // ms
  warnings: string[]
  error?: string
}

export interface IntegrityCheckResult {
  valid: boolean
  checks: {
    userDataIntegrity: boolean
    roleHierarchyIntegrity: boolean
    tokenIntegrity: boolean
    auditLogIntegrity: boolean
    configurationIntegrity: boolean
  }
  issues: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    affectedItems: string[]
    recommendation: string
  }>
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
    criticalIssues: number
  }
}