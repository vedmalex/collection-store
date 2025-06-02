import { AuditLog, AuthContext } from './types';
export interface IAuditLogger {
    logAuthentication(userId: string | null, action: AuthenticationAction, result: 'success' | 'failure' | 'denied', context: AuthContext, details?: Record<string, any>): Promise<void>;
    logAuthorization(userId: string, resource: string, action: string, result: 'success' | 'failure' | 'denied', context: AuthContext, details?: Record<string, any>): Promise<void>;
    logUserManagement(performedBy: string, targetUserId: string, action: UserManagementAction, result: 'success' | 'failure', context: AuthContext, details?: Record<string, any>): Promise<void>;
    logRoleManagement(performedBy: string, roleId: string, action: RoleManagementAction, result: 'success' | 'failure', context: AuthContext, details?: Record<string, any>): Promise<void>;
    logSession(userId: string, sessionId: string, action: SessionAction, context: AuthContext, details?: Record<string, any>): Promise<void>;
    logSecurity(userId: string | null, action: SecurityAction, severity: SecuritySeverity, context: AuthContext, details?: Record<string, any>): Promise<void>;
    logEvent(userId: string | null, action: string, resource: string, result: 'success' | 'failure' | 'denied', context: AuthContext, details?: Record<string, any>): Promise<void>;
    logBatch(events: AuditLogEntry[]): Promise<void>;
    startBatch(): BatchLogger;
    flushBatch(): Promise<void>;
    queryLogs(query: AuditQuery): Promise<AuditLogResult>;
    getUserActivity(userId: string, timeRange?: TimeRange, actions?: string[]): Promise<AuditLog[]>;
    getResourceAccess(resource: string, timeRange?: TimeRange, actions?: string[]): Promise<AuditLog[]>;
    getFailedAttempts(timeRange?: TimeRange, userId?: string, ipAddress?: string): Promise<AuditLog[]>;
    getSecurityEvents(severity?: SecuritySeverity, timeRange?: TimeRange): Promise<AuditLog[]>;
    getActivitySummary(timeRange: TimeRange): Promise<ActivitySummary>;
    getSecurityReport(timeRange: TimeRange): Promise<SecurityReport>;
    getUserBehaviorAnalytics(userId: string, days: number): Promise<UserBehaviorAnalytics>;
    getUsageStatistics(timeRange: TimeRange): Promise<UsageStatistics>;
    detectAnomalies(userId?: string, timeRange?: TimeRange): Promise<AnomalyReport[]>;
    cleanupOldLogs(): Promise<CleanupResult>;
    archiveLogs(beforeDate: Date, archiveLocation: string): Promise<ArchiveResult>;
    getRetentionStatus(): Promise<RetentionStatus>;
    updateRetentionPolicy(policy: RetentionPolicy): Promise<void>;
    getConfiguration(): Promise<AuditLoggerConfig>;
    updateConfiguration(config: Partial<AuditLoggerConfig>): Promise<void>;
    getStatistics(): Promise<AuditLoggerStats>;
    testLogging(): Promise<TestResult>;
    subscribe(filter: AuditEventFilter, callback: AuditEventCallback): Promise<string>;
    unsubscribe(subscriptionId: string): Promise<void>;
    getSubscriptions(): Promise<AuditSubscription[]>;
}
export type AuthenticationAction = 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'token_refresh' | 'token_revoke' | 'password_change' | 'password_reset';
export type UserManagementAction = 'user_create' | 'user_update' | 'user_delete' | 'user_activate' | 'user_deactivate' | 'user_lock' | 'user_unlock' | 'role_assign' | 'role_remove' | 'attribute_set' | 'attribute_remove';
export type RoleManagementAction = 'role_create' | 'role_update' | 'role_delete' | 'permission_add' | 'permission_remove' | 'hierarchy_change';
export type SessionAction = 'session_start' | 'session_end' | 'session_timeout' | 'session_terminate' | 'concurrent_limit_exceeded';
export type SecurityAction = 'brute_force_detected' | 'suspicious_login' | 'privilege_escalation' | 'unauthorized_access' | 'data_breach_attempt' | 'configuration_change' | 'key_rotation' | 'backup_access';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export interface AuditLogEntry {
    userId?: string;
    sessionId?: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'denied';
    context: AuthContext;
    details?: Record<string, any>;
    timestamp?: Date;
}
export interface BatchLogger {
    log(entry: AuditLogEntry): void;
    flush(): Promise<void>;
    size(): number;
}
export interface AuditQuery {
    userId?: string;
    sessionId?: string;
    action?: string | string[];
    resource?: string | string[];
    result?: 'success' | 'failure' | 'denied';
    timeRange?: TimeRange;
    ipAddress?: string;
    limit?: number;
    offset?: number;
    sortBy?: keyof AuditLog;
    sortOrder?: 'asc' | 'desc';
}
export interface AuditLogResult {
    logs: AuditLog[];
    total: number;
    hasMore: boolean;
    query: AuditQuery;
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface ActivitySummary {
    timeRange: TimeRange;
    totalEvents: number;
    uniqueUsers: number;
    eventsByAction: Record<string, number>;
    eventsByResult: Record<string, number>;
    eventsByHour: Record<string, number>;
    topUsers: Array<{
        userId: string;
        eventCount: number;
    }>;
    topResources: Array<{
        resource: string;
        accessCount: number;
    }>;
}
export interface SecurityReport {
    timeRange: TimeRange;
    securityEvents: number;
    failedLogins: number;
    suspiciousActivities: number;
    bruteForceAttempts: number;
    unauthorizedAccess: number;
    eventsBySeverity: Record<SecuritySeverity, number>;
    topThreats: Array<{
        type: string;
        count: number;
        severity: SecuritySeverity;
    }>;
    affectedUsers: string[];
    sourceIPs: Array<{
        ip: string;
        eventCount: number;
        riskScore: number;
    }>;
}
export interface UserBehaviorAnalytics {
    userId: string;
    timeRange: TimeRange;
    loginPattern: {
        averageLoginsPerDay: number;
        mostActiveHours: number[];
        mostActiveDays: string[];
        averageSessionDuration: number;
    };
    accessPattern: {
        mostAccessedResources: Array<{
            resource: string;
            count: number;
        }>;
        accessByAction: Record<string, number>;
        unusualAccess: Array<{
            resource: string;
            reason: string;
        }>;
    };
    riskScore: number;
    anomalies: string[];
}
export interface UsageStatistics {
    timeRange: TimeRange;
    totalRequests: number;
    uniqueUsers: number;
    averageRequestsPerUser: number;
    peakUsageTime: Date;
    resourceUsage: Record<string, number>;
    actionDistribution: Record<string, number>;
    errorRate: number;
    averageResponseTime: number;
}
export interface AnomalyReport {
    id: string;
    type: 'unusual_access' | 'time_anomaly' | 'location_anomaly' | 'volume_anomaly';
    severity: SecuritySeverity;
    userId?: string;
    description: string;
    detectedAt: Date;
    evidence: Record<string, any>;
    riskScore: number;
    recommended_actions: string[];
}
export interface CleanupResult {
    deletedCount: number;
    freedSpace: number;
    oldestRemainingLog: Date;
    errors: string[];
}
export interface ArchiveResult {
    archivedCount: number;
    archiveSize: number;
    archiveLocation: string;
    errors: string[];
}
export interface RetentionStatus {
    policy: RetentionPolicy;
    totalLogs: number;
    oldestLog: Date;
    newestLog: Date;
    estimatedCleanupDate: Date;
    storageUsed: number;
}
export interface RetentionPolicy {
    type: 'time' | 'count';
    value: number;
    archiveBeforeDelete: boolean;
    archiveLocation?: string;
}
export interface AuditLoggerConfig {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'detailed';
    batchSize: number;
    flushInterval: number;
    useWAL: boolean;
    compression: boolean;
    retention: RetentionPolicy;
    realTimeEnabled: boolean;
    anonymizeData: boolean;
}
export interface AuditLoggerStats {
    totalLogsWritten: number;
    logsPerSecond: number;
    averageWriteTime: number;
    batchesProcessed: number;
    errorsCount: number;
    storageUsed: number;
    oldestLog: Date;
    newestLog: Date;
    activeSubscriptions: number;
}
export interface TestResult {
    success: boolean;
    writeTest: {
        success: boolean;
        duration: number;
        error?: string;
    };
    readTest: {
        success: boolean;
        duration: number;
        error?: string;
    };
    batchTest: {
        success: boolean;
        duration: number;
        batchSize: number;
        error?: string;
    };
}
export interface AuditEventFilter {
    userId?: string;
    action?: string | string[];
    resource?: string | string[];
    result?: 'success' | 'failure' | 'denied';
    severity?: SecuritySeverity;
}
export type AuditEventCallback = (event: AuditLog) => void;
export interface AuditSubscription {
    id: string;
    filter: AuditEventFilter;
    createdAt: Date;
    lastEventAt?: Date;
    eventCount: number;
    isActive: boolean;
}
