import { CSDatabase } from '../../CSDatabase';
import { User, AuthCredentials, AuthResult, AuthContext, TokenPair, TokenValidation, AuthConfig, ResourceDescriptor, AuthorizationResult, CreateUserData, UpdateUserData } from './types';
import { IUserManager } from './IUserManager';
import { ITokenManager } from './ITokenManager';
import { IAuditLogger } from './IAuditLogger';
export interface IAuthManager {
    initialize(database: CSDatabase, config: AuthConfig): Promise<void>;
    getConfiguration(): Promise<AuthConfig>;
    updateConfiguration(config: Partial<AuthConfig>): Promise<void>;
    healthCheck(): Promise<HealthCheckResult>;
    authenticate(credentials: AuthCredentials): Promise<AuthResult>;
    validateToken(token: string): Promise<TokenValidation>;
    refreshToken(refreshToken: string): Promise<TokenPair>;
    revokeToken(tokenId: string): Promise<void>;
    logout(userId: string, sessionId?: string): Promise<void>;
    logoutFromAllSessions(userId: string): Promise<void>;
    checkPermission(user: User, resource: ResourceDescriptor, action: string, context?: AuthContext): Promise<AuthorizationResult>;
    checkPermissions(user: User, permissions: Array<{
        resource: ResourceDescriptor;
        action: string;
    }>, context?: AuthContext): Promise<AuthorizationResult[]>;
    getUserPermissions(userId: string): Promise<EffectivePermissions>;
    hasRole(userId: string, roleId: string): Promise<boolean>;
    hasAnyRole(userId: string, roleIds: string[]): Promise<boolean>;
    hasAllRoles(userId: string, roleIds: string[]): Promise<boolean>;
    createUser(userData: CreateUserData, context?: AuthContext): Promise<User>;
    getUser(userId: string): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    updateUser(userId: string, updates: UpdateUserData, context?: AuthContext): Promise<User>;
    changePassword(userId: string, currentPassword: string, newPassword: string, context?: AuthContext): Promise<void>;
    resetPassword(userId: string, newPassword: string, requireChange: boolean, context?: AuthContext): Promise<void>;
    deactivateUser(userId: string, context?: AuthContext): Promise<void>;
    activateUser(userId: string, context?: AuthContext): Promise<void>;
    getUserSessions(userId: string): Promise<SessionInfo[]>;
    terminateSession(sessionId: string): Promise<void>;
    terminateOtherSessions(userId: string, currentSessionId: string): Promise<void>;
    getSessionInfo(sessionId: string): Promise<SessionInfo | null>;
    extendSession(sessionId: string, extensionTime?: number): Promise<void>;
    configureExternalAuth(config: ExternalAuthConfig): Promise<void>;
    authenticateExternal(providerId: string, externalToken: string, context?: AuthContext): Promise<AuthResult>;
    linkExternalAccount(userId: string, providerId: string, externalUserId: string): Promise<void>;
    unlinkExternalAccount(userId: string, providerId: string): Promise<void>;
    getExternalAccounts(userId: string): Promise<ExternalAccount[]>;
    lockUser(userId: string, reason: string, context?: AuthContext): Promise<void>;
    unlockUser(userId: string, context?: AuthContext): Promise<void>;
    isUserLocked(userId: string): Promise<boolean>;
    getFailedLoginAttempts(userId: string): Promise<number>;
    resetFailedLoginAttempts(userId: string): Promise<void>;
    checkSuspiciousActivity(userId: string, context: AuthContext): Promise<SuspiciousActivityResult>;
    getAuthStats(timeRange?: TimeRange): Promise<AuthStats>;
    getUserActivity(userId: string, days?: number): Promise<UserActivitySummary>;
    getSecurityEvents(timeRange?: TimeRange): Promise<SecurityEvent[]>;
    generateSecurityReport(timeRange: TimeRange): Promise<SecurityReport>;
    getUserManager(): IUserManager;
    getTokenManager(): ITokenManager;
    getAuditLogger(): IAuditLogger;
    cleanup(): Promise<CleanupResult>;
    rotateKeys(): Promise<void>;
    backup(location: string): Promise<BackupResult>;
    restore(location: string): Promise<RestoreResult>;
    validateIntegrity(): Promise<IntegrityCheckResult>;
}
export interface HealthCheckResult {
    healthy: boolean;
    components: {
        database: ComponentHealth;
        userManager: ComponentHealth;
        tokenManager: ComponentHealth;
        auditLogger: ComponentHealth;
    };
    performance: {
        authenticationTime: number;
        authorizationTime: number;
        tokenValidationTime: number;
    };
    errors: string[];
    warnings: string[];
}
export interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    error?: string;
    lastCheck: Date;
}
export interface EffectivePermissions {
    userId: string;
    roles: string[];
    permissions: Array<{
        resource: string;
        actions: string[];
        scope?: string;
        inherited?: boolean;
    }>;
    computedAt: Date;
}
export interface SessionInfo {
    id: string;
    userId: string;
    createdAt: Date;
    lastAccessAt: Date;
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
    tokenCount: number;
}
export interface ExternalAuthConfig {
    providerId: string;
    enabled: boolean;
    config: Record<string, any>;
    userMapping: {
        email: string;
        firstName?: string;
        lastName?: string;
        roles?: string[];
    };
}
export interface ExternalAccount {
    providerId: string;
    externalUserId: string;
    email?: string;
    linkedAt: Date;
    lastUsedAt?: Date;
    isActive: boolean;
}
export interface SuspiciousActivityResult {
    suspicious: boolean;
    riskScore: number;
    reasons: string[];
    recommendedActions: string[];
    shouldBlock: boolean;
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface AuthStats {
    timeRange: TimeRange;
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    uniqueUsers: number;
    newUsers: number;
    tokensIssued: number;
    tokensRevoked: number;
    averageSessionDuration: number;
    peakConcurrentUsers: number;
    topFailureReasons: Array<{
        reason: string;
        count: number;
    }>;
}
export interface UserActivitySummary {
    userId: string;
    timeRange: TimeRange;
    loginCount: number;
    lastLogin: Date | null;
    averageSessionDuration: number;
    actionsPerformed: number;
    resourcesAccessed: string[];
    failedAttempts: number;
    suspiciousActivity: boolean;
}
export interface SecurityEvent {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
    description: string;
    timestamp: Date;
    context: AuthContext;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
}
export interface SecurityReport {
    timeRange: TimeRange;
    summary: {
        totalEvents: number;
        criticalEvents: number;
        affectedUsers: number;
        resolvedEvents: number;
    };
    events: SecurityEvent[];
    trends: {
        eventsByDay: Record<string, number>;
        eventsByType: Record<string, number>;
        eventsBySeverity: Record<string, number>;
    };
    recommendations: string[];
}
export interface CleanupResult {
    expiredTokens: number;
    expiredSessions: number;
    oldAuditLogs: number;
    freedSpace: number;
    errors: string[];
}
export interface BackupResult {
    success: boolean;
    location: string;
    size: number;
    itemsBackedUp: {
        users: number;
        roles: number;
        sessions: number;
        auditLogs: number;
    };
    duration: number;
    error?: string;
}
export interface RestoreResult {
    success: boolean;
    itemsRestored: {
        users: number;
        roles: number;
        sessions: number;
        auditLogs: number;
    };
    duration: number;
    warnings: string[];
    error?: string;
}
export interface IntegrityCheckResult {
    valid: boolean;
    checks: {
        userDataIntegrity: boolean;
        roleHierarchyIntegrity: boolean;
        tokenIntegrity: boolean;
        auditLogIntegrity: boolean;
        configurationIntegrity: boolean;
    };
    issues: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        affectedItems: string[];
        recommendation: string;
    }>;
    summary: {
        totalChecks: number;
        passedChecks: number;
        failedChecks: number;
        criticalIssues: number;
    };
}
