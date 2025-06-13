// Audit Logging Types for Collection Store Auth System
// Comprehensive audit logging and monitoring types

import { User, AuthContext } from '../interfaces/types'

// ============================================================================
// Core Audit Types
// ============================================================================

export interface AuditLogEntry {
  id: string
  timestamp: Date
  userId?: string
  sessionId?: string
  action: AuditAction
  category: AuditCategory
  severity: AuditSeverity
  resource: string
  resourceId?: string
  details: AuditDetails
  context: AuditContext
  outcome: AuditOutcome
  metadata?: Record<string, any>
}

export type AuditAction =
  // Authentication actions
  | 'auth.login.attempt'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.session.create'
  | 'auth.session.refresh'
  | 'auth.session.expire'
  | 'auth.session.terminate'
  | 'auth.password.change'
  | 'auth.password.reset'
  | 'auth.mfa.enable'
  | 'auth.mfa.disable'
  | 'auth.mfa.verify'

  // User management actions
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.activate'
  | 'user.deactivate'
  | 'user.lock'
  | 'user.unlock'
  | 'user.role.assign'
  | 'user.role.remove'
  | 'user.attribute.set'
  | 'user.attribute.remove'

  // Role management actions
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'role.permission.add'
  | 'role.permission.remove'
  | 'role.hierarchy.change'

  // Token management actions
  | 'token.create'
  | 'token.validate'
  | 'token.refresh'
  | 'token.revoke'
  | 'token.expire'

  // Security actions
  | 'security.suspicious.activity'
  | 'security.brute.force'
  | 'security.policy.violation'
  | 'security.access.denied'
  | 'security.privilege.escalation'

  // System actions
  | 'system.config.change'
  | 'system.backup.create'
  | 'system.backup.restore'
  | 'system.maintenance.start'
  | 'system.maintenance.end'
  | 'system.error'

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'user_management'
  | 'role_management'
  | 'session_management'
  | 'token_management'
  | 'security'
  | 'system'
  | 'data_access'
  | 'configuration'

export type AuditSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info'

export type AuditOutcome =
  | 'success'
  | 'failure'
  | 'error'
  | 'warning'
  | 'info'

export interface AuditDetails {
  description: string
  oldValue?: any
  newValue?: any
  reason?: string
  errorMessage?: string
  stackTrace?: string
  additionalInfo?: Record<string, any>
}

export interface AuditContext {
  ipAddress: string
  userAgent: string
  requestId?: string
  correlationId?: string
  source: string
  location?: GeoLocation
  device?: DeviceInfo
}

export interface GeoLocation {
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'api' | 'unknown'
  os?: string
  browser?: string
  version?: string
  fingerprint?: string
}

// ============================================================================
// Audit Query and Filtering
// ============================================================================

export interface AuditQuery {
  userId?: string
  sessionId?: string
  action?: AuditAction | AuditAction[]
  category?: AuditCategory | AuditCategory[]
  severity?: AuditSeverity | AuditSeverity[]
  outcome?: AuditOutcome | AuditOutcome[]
  resource?: string
  resourceId?: string
  from?: Date
  to?: Date
  ipAddress?: string
  source?: string
  limit?: number
  offset?: number
  sortBy?: 'timestamp' | 'severity' | 'action'
  sortOrder?: 'asc' | 'desc'
}

export interface AuditQueryResult {
  entries: AuditLogEntry[]
  total: number
  hasMore: boolean
  nextOffset?: number
}

// ============================================================================
// Audit Analytics
// ============================================================================

export interface AuditAnalytics {
  timeRange: { from: Date; to: Date }
  totalEntries: number
  entriesByCategory: Record<AuditCategory, number>
  entriesBySeverity: Record<AuditSeverity, number>
  entriesByOutcome: Record<AuditOutcome, number>
  topActions: Array<{ action: AuditAction; count: number }>
  topUsers: Array<{ userId: string; count: number }>
  topResources: Array<{ resource: string; count: number }>
  securityEvents: number
  failureRate: number
  trends: AuditTrend[]
}

export interface AuditTrend {
  timestamp: Date
  category: AuditCategory
  count: number
  severity: AuditSeverity
}

export interface UserAuditSummary {
  userId: string
  totalActions: number
  lastActivity: Date
  actionsByCategory: Record<AuditCategory, number>
  securityEvents: number
  failedAttempts: number
  riskScore: number
  recentActions: AuditLogEntry[]
}

export interface SecurityReport {
  timeRange: { from: Date; to: Date }
  totalSecurityEvents: number
  criticalEvents: number
  suspiciousActivities: number
  bruteForceAttempts: number
  policyViolations: number
  accessDenials: number
  topThreats: Array<{
    type: string
    count: number
    severity: AuditSeverity
    affectedUsers: number
  }>
  riskTrends: Array<{
    timestamp: Date
    riskScore: number
    eventCount: number
  }>
}

// ============================================================================
// Audit Configuration
// ============================================================================

export interface AuditConfig {
  enabled: boolean
  logLevel: AuditSeverity
  retentionPeriod: number // days
  maxLogSize: number // MB
  enableRealTimeAlerts: boolean
  enableAnalytics: boolean
  enableSecurityReporting: boolean
  batchSize: number
  flushInterval: number // seconds
  compressionEnabled: boolean
  encryptionEnabled: boolean
  categories: AuditCategoryConfig[]
  alertRules: AuditAlertRule[]
}

export interface AuditCategoryConfig {
  category: AuditCategory
  enabled: boolean
  logLevel: AuditSeverity
  retentionPeriod?: number
  enableRealTimeProcessing: boolean
}

export interface AuditAlertRule {
  id: string
  name: string
  description: string
  enabled: boolean
  conditions: AuditAlertCondition[]
  actions: AuditAlertAction[]
  cooldownPeriod: number // seconds
  severity: AuditSeverity
}

export interface AuditAlertCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: any
  timeWindow?: number // seconds
  threshold?: number
}

export interface AuditAlertAction {
  type: 'email' | 'webhook' | 'log' | 'block_user' | 'terminate_session'
  target: string
  template?: string
  metadata?: Record<string, any>
}

// ============================================================================
// Batch Processing
// ============================================================================

export interface AuditBatch {
  id: string
  entries: AuditLogEntry[]
  createdAt: Date
  processedAt?: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
}

export interface BatchProcessingResult {
  batchId: string
  processed: number
  failed: number
  errors: Array<{ entry: AuditLogEntry; error: string }>
  duration: number
}

// ============================================================================
// Real-time Monitoring
// ============================================================================

export interface AuditEventSubscription {
  id: string
  userId?: string
  categories?: AuditCategory[]
  actions?: AuditAction[]
  severities?: AuditSeverity[]
  callback: AuditEventCallback
  filter?: AuditEventFilter
}

export type AuditEventCallback = (entry: AuditLogEntry) => void | Promise<void>

export interface AuditEventFilter {
  userId?: string
  sessionId?: string
  ipAddress?: string
  resource?: string
  customFilter?: (entry: AuditLogEntry) => boolean
}

// ============================================================================
// Compliance and Reporting
// ============================================================================

export interface ComplianceReport {
  reportId: string
  type: ComplianceReportType
  timeRange: { from: Date; to: Date }
  generatedAt: Date
  summary: ComplianceSummary
  details: ComplianceDetails
  violations: ComplianceViolation[]
  recommendations: string[]
}

export type ComplianceReportType =
  | 'gdpr'
  | 'hipaa'
  | 'sox'
  | 'pci_dss'
  | 'iso27001'
  | 'custom'

export interface ComplianceSummary {
  totalEvents: number
  complianceScore: number
  violationCount: number
  criticalViolations: number
  dataAccessEvents: number
  userConsentEvents: number
  dataRetentionCompliance: boolean
}

export interface ComplianceDetails {
  dataProcessingActivities: Array<{
    activity: string
    count: number
    legalBasis?: string
    dataSubjects: number
  }>
  accessControls: Array<{
    resource: string
    accessCount: number
    authorizedUsers: number
    unauthorizedAttempts: number
  }>
  dataRetention: Array<{
    dataType: string
    retentionPeriod: number
    itemsRetained: number
    itemsDeleted: number
  }>
}

export interface ComplianceViolation {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  affectedData: string[]
  affectedUsers: string[]
  detectedAt: Date
  resolvedAt?: Date
  resolution?: string
  evidence: AuditLogEntry[]
}

// ============================================================================
// Archive and Backup
// ============================================================================

export interface AuditArchiveConfig {
  enabled: boolean
  archiveAfterDays: number
  compressionLevel: number
  encryptionKey?: string
  storageLocation: string
  retentionPeriod: number // days
  verificationEnabled: boolean
}

export interface AuditArchiveResult {
  archiveId: string
  entriesArchived: number
  archiveSize: number
  compressionRatio: number
  checksum: string
  createdAt: Date
  location: string
}

export interface AuditRestoreRequest {
  archiveId: string
  timeRange?: { from: Date; to: Date }
  categories?: AuditCategory[]
  userId?: string
  verifyIntegrity: boolean
}

export interface AuditRestoreResult {
  requestId: string
  entriesRestored: number
  integrityVerified: boolean
  errors: string[]
  restoredAt: Date
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export interface AuditPerformanceMetrics {
  timestamp: Date
  entriesPerSecond: number
  averageProcessingTime: number
  queueSize: number
  memoryUsage: number
  diskUsage: number
  errorRate: number
  alertsTriggered: number
}

export interface AuditHealthCheck {
  healthy: boolean
  issues: string[]
  metrics: AuditPerformanceMetrics
  lastProcessedEntry?: Date
  queueBacklog: number
  storageAvailable: number
}