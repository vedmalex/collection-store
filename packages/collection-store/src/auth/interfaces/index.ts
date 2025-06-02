// Collection Store Auth System - Interface Exports
// Centralized export of all authentication and authorization interfaces

// Core types and interfaces
export * from './types'

// Main interfaces
export { IAuthManager } from './IAuthManager'
export { IRoleManager } from './IRoleManager'
export { IUserManager } from './IUserManager'
export { ITokenManager } from './ITokenManager'
export { ISessionManager } from './ISessionManager'
export { IAuditLogger } from './IAuditLogger'

// Export audit types with aliases to avoid conflicts
export {
  AuditLogEntry as NewAuditLogEntry,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditDetails,
  AuditContext,
  AuditQuery as NewAuditQuery,
  AuditQueryResult,
  AuditAnalytics,
  UserAuditSummary,
  SecurityReport as NewSecurityReport,
  AuditConfig as NewAuditConfig,
  AuditBatch,
  BatchProcessingResult,
  AuditEventSubscription,
  ComplianceReport,
  ComplianceReportType,
  AuditPerformanceMetrics,
  AuditHealthCheck
} from '../audit/types'

// Export specific types from other modules to avoid conflicts
export type {
  HealthCheckResult,
  ComponentHealth,
  EffectivePermissions,
  SessionInfo,
  SuspiciousActivityResult,
  AuthStats,
  UserActivitySummary,
  SecurityEvent,
  BackupResult,
  RestoreResult,
  IntegrityCheckResult
} from './IAuthManager'

export type {
  UserSearchCriteria,
  UserListOptions,
  UserListResult,
  UserSearchOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PasswordValidationResult,
  BulkOperationResult,
  UserStats,
  UserActivity
} from './IUserManager'

export type {
  ApiKeyInfo,
  TokenSession,
  TokenMetadata,
  TokenClaims,
  TokenHeader,
  KeyValidationResult,
  TokenTestResult,
  TokenStats,
  TokenMetrics,
  ITokenStorage
} from './ITokenManager'

export type {
  AuthenticationAction,
  UserManagementAction,
  RoleManagementAction,
  SessionAction,
  SecurityAction,
  SecuritySeverity,
  AuditLogEntry,
  BatchLogger,
  AuditQuery,
  AuditLogResult,
  ActivitySummary,
  UserBehaviorAnalytics,
  UsageStatistics,
  AnomalyReport,
  ArchiveResult,
  RetentionStatus,
  RetentionPolicy,
  AuditLoggerConfig,
  AuditLoggerStats,
  TestResult,
  AuditEventFilter,
  AuditEventCallback,
  AuditSubscription
} from './IAuditLogger'

// Collection Schema Types
export type {
  UserSchema,
  RoleSchema,
  SessionSchema,
  AuditLogSchema
} from './types'