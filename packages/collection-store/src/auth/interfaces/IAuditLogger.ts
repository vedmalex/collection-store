// Audit Logging Interface for Collection Store Auth System
// Integrates with existing WAL system for comprehensive audit trails

import { AuditLog, AuthContext } from './types'
import {
  AuditLogEntry as NewAuditLogEntry,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditQuery as NewAuditQuery,
  AuditQueryResult,
  AuditAnalytics,
  UserAuditSummary,
  SecurityReport as NewSecurityReport,
  AuditConfig,
  AuditBatch,
  BatchProcessingResult,
  AuditEventSubscription,
  ComplianceReport,
  ComplianceReportType,
  AuditArchiveResult,
  AuditRestoreRequest,
  AuditRestoreResult,
  AuditPerformanceMetrics,
  AuditHealthCheck
} from '../audit/types'

export interface IAuditLogger {
  // ============================================================================
  // Core Logging Operations
  // ============================================================================

  /**
   * Log authentication event
   */
  logAuthentication(
    userId: string | null,
    action: AuthenticationAction,
    result: 'success' | 'failure' | 'denied',
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  /**
   * Log authorization event
   */
  logAuthorization(
    userId: string,
    resource: string,
    action: string,
    result: 'success' | 'failure' | 'denied',
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  /**
   * Log user management event
   */
  logUserManagement(
    performedBy: string,
    targetUserId: string,
    action: UserManagementAction,
    result: 'success' | 'failure',
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  /**
   * Log role management event
   */
  logRoleManagement(
    performedBy: string,
    roleId: string,
    action: RoleManagementAction,
    result: 'success' | 'failure',
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  /**
   * Log session event
   */
  logSession(
    userId: string,
    sessionId: string,
    action: SessionAction,
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  /**
   * Log security event
   */
  logSecurity(
    userId: string | null,
    action: SecurityAction,
    severity: SecuritySeverity,
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  /**
   * Log generic audit event
   */
  logEvent(
    userId: string | null,
    action: string,
    resource: string,
    result: 'success' | 'failure' | 'denied',
    context: AuthContext,
    details?: Record<string, any>
  ): Promise<void>

  // ============================================================================
  // Batch Logging Operations
  // ============================================================================

  /**
   * Log multiple events in batch
   */
  logBatch(events: AuditLogEntry[]): Promise<void>

  /**
   * Start batch logging session
   */
  startBatch(): BatchLogger

  /**
   * Flush pending batch logs
   */
  flushBatch(): Promise<void>

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Query audit logs with filters
   */
  queryLogs(query: AuditQuery): Promise<AuditLogResult>

  /**
   * Get user activity logs
   */
  getUserActivity(
    userId: string,
    timeRange?: TimeRange,
    actions?: string[]
  ): Promise<AuditLog[]>

  /**
   * Get resource access logs
   */
  getResourceAccess(
    resource: string,
    timeRange?: TimeRange,
    actions?: string[]
  ): Promise<AuditLog[]>

  /**
   * Get failed authentication attempts
   */
  getFailedAttempts(
    timeRange?: TimeRange,
    userId?: string,
    ipAddress?: string
  ): Promise<AuditLog[]>

  /**
   * Get security events
   */
  getSecurityEvents(
    severity?: SecuritySeverity,
    timeRange?: TimeRange
  ): Promise<AuditLog[]>

  // ============================================================================
  // Analytics and Reporting
  // ============================================================================

  /**
   * Generate activity summary
   */
  getActivitySummary(timeRange: TimeRange): Promise<ActivitySummary>

  /**
   * Generate security report
   */
  getSecurityReport(timeRange: TimeRange): Promise<SecurityReport>

  /**
   * Get user behavior analytics
   */
  getUserBehaviorAnalytics(userId: string, days: number): Promise<UserBehaviorAnalytics>

  /**
   * Get system usage statistics
   */
  getUsageStatistics(timeRange: TimeRange): Promise<UsageStatistics>

  /**
   * Detect anomalous behavior
   */
  detectAnomalies(userId?: string, timeRange?: TimeRange): Promise<AnomalyReport[]>

  // ============================================================================
  // Retention and Cleanup
  // ============================================================================

  /**
   * Clean up old audit logs based on retention policy
   */
  cleanupOldLogs(): Promise<CleanupResult>

  /**
   * Archive old logs to external storage
   */
  archiveLogs(beforeDate: Date, archiveLocation: string): Promise<ArchiveResult>

  /**
   * Get retention policy status
   */
  getRetentionStatus(): Promise<RetentionStatus>

  /**
   * Update retention policy
   */
  updateRetentionPolicy(policy: RetentionPolicy): Promise<void>

  // ============================================================================
  // Configuration and Monitoring
  // ============================================================================

  /**
   * Get audit logger configuration
   */
  getConfiguration(): Promise<AuditLoggerConfig>

  /**
   * Update audit logger configuration
   */
  updateConfiguration(config: Partial<AuditLoggerConfig>): Promise<void>

  /**
   * Get audit logger statistics
   */
  getStatistics(): Promise<AuditLoggerStats>

  /**
   * Test audit logging functionality
   */
  testLogging(): Promise<TestResult>

  // ============================================================================
  // Real-time Monitoring
  // ============================================================================

  /**
   * Subscribe to real-time audit events
   */
  subscribe(filter: AuditEventFilter, callback: AuditEventCallback): Promise<string>

  /**
   * Unsubscribe from audit events
   */
  unsubscribe(subscriptionId: string): Promise<void>

  /**
   * Get active subscriptions
   */
  getSubscriptions(): Promise<AuditSubscription[]>
}

// ============================================================================
// Supporting Types
// ============================================================================

export type AuthenticationAction =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_refresh'
  | 'token_revoke'
  | 'password_change'
  | 'password_reset'

export type UserManagementAction =
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_activate'
  | 'user_deactivate'
  | 'user_lock'
  | 'user_unlock'
  | 'role_assign'
  | 'role_remove'
  | 'attribute_set'
  | 'attribute_remove'

export type RoleManagementAction =
  | 'role_create'
  | 'role_update'
  | 'role_delete'
  | 'permission_add'
  | 'permission_remove'
  | 'hierarchy_change'

export type SessionAction =
  | 'session_start'
  | 'session_end'
  | 'session_timeout'
  | 'session_terminate'
  | 'concurrent_limit_exceeded'

export type SecurityAction =
  | 'brute_force_detected'
  | 'suspicious_login'
  | 'privilege_escalation'
  | 'unauthorized_access'
  | 'data_breach_attempt'
  | 'configuration_change'
  | 'key_rotation'
  | 'backup_access'

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AuditLogEntry {
  userId?: string
  sessionId?: string
  action: string
  resource: string
  result: 'success' | 'failure' | 'denied'
  context: AuthContext
  details?: Record<string, any>
  timestamp?: Date
}

export interface BatchLogger {
  log(entry: AuditLogEntry): void
  flush(): Promise<void>
  size(): number
}

export interface AuditQuery {
  userId?: string
  sessionId?: string
  action?: string | string[]
  resource?: string | string[]
  result?: 'success' | 'failure' | 'denied'
  timeRange?: TimeRange
  ipAddress?: string
  limit?: number
  offset?: number
  sortBy?: keyof AuditLog
  sortOrder?: 'asc' | 'desc'
}

export interface AuditLogResult {
  logs: AuditLog[]
  total: number
  hasMore: boolean
  query: AuditQuery
}

export interface TimeRange {
  start: Date
  end: Date
}

export interface ActivitySummary {
  timeRange: TimeRange
  totalEvents: number
  uniqueUsers: number
  eventsByAction: Record<string, number>
  eventsByResult: Record<string, number>
  eventsByHour: Record<string, number>
  topUsers: Array<{ userId: string; eventCount: number }>
  topResources: Array<{ resource: string; accessCount: number }>
}

export interface SecurityReport {
  timeRange: TimeRange
  securityEvents: number
  failedLogins: number
  suspiciousActivities: number
  bruteForceAttempts: number
  unauthorizedAccess: number
  eventsBySeverity: Record<SecuritySeverity, number>
  topThreats: Array<{ type: string; count: number; severity: SecuritySeverity }>
  affectedUsers: string[]
  sourceIPs: Array<{ ip: string; eventCount: number; riskScore: number }>
}

export interface UserBehaviorAnalytics {
  userId: string
  timeRange: TimeRange
  loginPattern: {
    averageLoginsPerDay: number
    mostActiveHours: number[]
    mostActiveDays: string[]
    averageSessionDuration: number
  }
  accessPattern: {
    mostAccessedResources: Array<{ resource: string; count: number }>
    accessByAction: Record<string, number>
    unusualAccess: Array<{ resource: string; reason: string }>
  }
  riskScore: number
  anomalies: string[]
}

export interface UsageStatistics {
  timeRange: TimeRange
  totalRequests: number
  uniqueUsers: number
  averageRequestsPerUser: number
  peakUsageTime: Date
  resourceUsage: Record<string, number>
  actionDistribution: Record<string, number>
  errorRate: number
  averageResponseTime: number
}

export interface AnomalyReport {
  id: string
  type: 'unusual_access' | 'time_anomaly' | 'location_anomaly' | 'volume_anomaly'
  severity: SecuritySeverity
  userId?: string
  description: string
  detectedAt: Date
  evidence: Record<string, any>
  riskScore: number
  recommended_actions: string[]
}

export interface CleanupResult {
  deletedCount: number
  freedSpace: number // bytes
  oldestRemainingLog: Date
  errors: string[]
}

export interface ArchiveResult {
  archivedCount: number
  archiveSize: number // bytes
  archiveLocation: string
  errors: string[]
}

export interface RetentionStatus {
  policy: RetentionPolicy
  totalLogs: number
  oldestLog: Date
  newestLog: Date
  estimatedCleanupDate: Date
  storageUsed: number // bytes
}

export interface RetentionPolicy {
  type: 'time' | 'count'
  value: number // days or count
  archiveBeforeDelete: boolean
  archiveLocation?: string
}

export interface AuditLoggerConfig {
  enabled: boolean
  logLevel: 'minimal' | 'standard' | 'detailed'
  batchSize: number
  flushInterval: number // seconds
  useWAL: boolean
  compression: boolean
  retention: RetentionPolicy
  realTimeEnabled: boolean
  anonymizeData: boolean
}

export interface AuditLoggerStats {
  totalLogsWritten: number
  logsPerSecond: number
  averageWriteTime: number // ms
  batchesProcessed: number
  errorsCount: number
  storageUsed: number // bytes
  oldestLog: Date
  newestLog: Date
  activeSubscriptions: number
}

export interface TestResult {
  success: boolean
  writeTest: {
    success: boolean
    duration: number // ms
    error?: string
  }
  readTest: {
    success: boolean
    duration: number // ms
    error?: string
  }
  batchTest: {
    success: boolean
    duration: number // ms
    batchSize: number
    error?: string
  }
}

export interface AuditEventFilter {
  userId?: string
  action?: string | string[]
  resource?: string | string[]
  result?: 'success' | 'failure' | 'denied'
  severity?: SecuritySeverity
}

export type AuditEventCallback = (event: AuditLog) => void

export interface AuditSubscription {
  id: string
  filter: AuditEventFilter
  createdAt: Date
  lastEventAt?: Date
  eventCount: number
  isActive: boolean
}