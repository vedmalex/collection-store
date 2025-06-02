import { CSDatabase } from '../../';
import { AuthContext } from '../interfaces/types';
import { ISessionManager } from '../interfaces/ISessionManager';
import { Session, CreateSessionData, UpdateSessionData, SessionValidationResult, Token, CreateTokenData, TokenValidationResult, TokenType, JWTPayload, JWTOptions, SessionSecurityEvent, SecurityEventType, SessionPolicy, SessionStats, UserSessionActivity, SessionCleanupResult, SessionMaintenanceConfig } from '../session/types';
export declare class SessionManager implements ISessionManager {
    private database;
    private sessionsCollection?;
    private securityEventsCollection?;
    private sessionPolicy;
    private maintenanceConfig;
    private initialized;
    constructor(database: CSDatabase);
    private ensureInitialized;
    private initializeCollections;
    createSession(sessionData: CreateSessionData, context: AuthContext): Promise<Session>;
    getSessionById(sessionId: string): Promise<Session | null>;
    updateSession(sessionId: string, updates: UpdateSessionData, context: AuthContext): Promise<Session>;
    deleteSession(sessionId: string, context: AuthContext): Promise<boolean>;
    validateSession(sessionId: string, context: AuthContext): Promise<SessionValidationResult>;
    refreshSession(sessionId: string, context: AuthContext): Promise<Session>;
    getUserSessions(userId: string, includeInactive?: boolean): Promise<Session[]>;
    getActiveSessionsCount(userId?: string): Promise<number>;
    terminateAllUserSessions(userId: string, context: AuthContext, excludeSessionId?: string): Promise<number>;
    terminateSessionsByCriteria(criteria: {
        userId?: string;
        deviceType?: string;
        ipAddress?: string;
        olderThan?: Date;
        suspicious?: boolean;
    }, context: AuthContext): Promise<number>;
    checkSuspiciousActivity(sessionId: string, context: AuthContext): Promise<{
        suspicious: boolean;
        reasons: string[];
        riskScore: number;
    }>;
    logSecurityEvent(event: Omit<SessionSecurityEvent, 'timestamp'>): Promise<void>;
    getSecurityEvents(filters: {
        sessionId?: string;
        userId?: string;
        type?: SecurityEventType;
        severity?: string;
        from?: Date;
        to?: Date;
        limit?: number;
    }): Promise<SessionSecurityEvent[]>;
    setSessionPolicy(policy: SessionPolicy): Promise<void>;
    getSessionPolicy(): Promise<SessionPolicy>;
    enforceSessionPolicy(userId: string, context: AuthContext): Promise<{
        allowed: boolean;
        reason?: string;
        actionsRequired?: string[];
    }>;
    createToken(tokenData: CreateTokenData, context: AuthContext): Promise<Token>;
    getTokenById(tokenId: string): Promise<Token | null>;
    getTokenByValue(tokenValue: string): Promise<Token | null>;
    validateToken(tokenValue: string, context: AuthContext): Promise<TokenValidationResult>;
    revokeToken(tokenId: string, context: AuthContext): Promise<boolean>;
    revokeAllUserTokens(userId: string, tokenType?: TokenType, context?: AuthContext): Promise<number>;
    getUserTokens(userId: string, tokenType?: TokenType, includeInactive?: boolean): Promise<Token[]>;
    updateTokenUsage(tokenId: string): Promise<void>;
    generateJWT(payload: JWTPayload, options?: JWTOptions): Promise<string>;
    verifyJWT(token: string): Promise<JWTPayload | null>;
    decodeJWT(token: string): Promise<{
        header: any;
        payload: JWTPayload;
    } | null>;
    refreshJWT(refreshToken: string, context: AuthContext): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    registerDevice(userId: string, deviceInfo: any, context: AuthContext): Promise<string>;
    getUserDevices(userId: string): Promise<Array<{
        deviceId: string;
        deviceInfo: any;
        lastUsed: Date;
        isActive: boolean;
    }>>;
    revokeDeviceAccess(userId: string, deviceId: string, context: AuthContext): Promise<boolean>;
    trustDevice(userId: string, deviceId: string, context: AuthContext): Promise<boolean>;
    checkRateLimit(tokenId: string, action: string): Promise<{
        allowed: boolean;
        remaining: number;
        resetAt: Date;
    }>;
    updateRateLimit(tokenId: string, action: string): Promise<void>;
    resetRateLimit(tokenId: string): Promise<void>;
    getSessionStats(timeRange?: {
        from: Date;
        to: Date;
    }): Promise<SessionStats>;
    getUserSessionActivity(userId: string, timeRange?: {
        from: Date;
        to: Date;
    }): Promise<UserSessionActivity>;
    getConcurrentSessions(timeRange?: {
        from: Date;
        to: Date;
    }): Promise<Array<{
        timestamp: Date;
        count: number;
    }>>;
    getSessionDurationAnalytics(timeRange?: {
        from: Date;
        to: Date;
    }): Promise<{
        average: number;
        median: number;
        percentiles: Record<string, number>;
        distribution: Array<{
            range: string;
            count: number;
        }>;
    }>;
    cleanupExpiredSessions(): Promise<SessionCleanupResult>;
    cleanupInactiveSessions(inactiveThreshold: number): Promise<SessionCleanupResult>;
    setMaintenanceConfig(config: SessionMaintenanceConfig): Promise<void>;
    getMaintenanceConfig(): Promise<SessionMaintenanceConfig>;
    runMaintenance(): Promise<SessionCleanupResult>;
    exportSessions(options?: {
        userId?: string;
        includeInactive?: boolean;
        includeTokens?: boolean;
        format?: 'json' | 'csv';
        timeRange?: {
            from: Date;
            to: Date;
        };
    }): Promise<string>;
    importSessions(data: string, options?: {
        overwriteExisting?: boolean;
        validateOnly?: boolean;
        format?: 'json' | 'csv';
    }, context?: AuthContext): Promise<{
        imported: number;
        skipped: number;
        errors: Array<{
            session: string;
            error: string;
        }>;
    }>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
        metrics: {
            activeSessions: number;
            expiredSessions: number;
            tokensIssued: number;
            securityEvents: number;
        };
    }>;
    getDiagnostics(): Promise<{
        sessionCount: number;
        tokenCount: number;
        averageSessionDuration: number;
        securityEventCount: number;
        memoryUsage: number;
        cacheHitRate: number;
    }>;
}
