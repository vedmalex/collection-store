import { User } from '../interfaces/types';
export interface Session {
    id: string;
    userId: string;
    deviceId?: string;
    deviceInfo?: DeviceInfo;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
    lastAccessedAt: Date;
    expiresAt: Date;
    isActive: boolean;
    metadata?: Record<string, any>;
    securityFlags?: SecurityFlags;
}
export interface DeviceInfo {
    type: 'desktop' | 'mobile' | 'tablet' | 'api' | 'unknown';
    os?: string;
    browser?: string;
    version?: string;
    fingerprint?: string;
}
export interface SecurityFlags {
    isSecure: boolean;
    isTrusted: boolean;
    requiresMFA: boolean;
    hasElevatedPrivileges: boolean;
    suspiciousActivity: boolean;
    geoLocation?: GeoLocation;
}
export interface GeoLocation {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
}
export interface CreateSessionData {
    userId: string;
    deviceId?: string;
    deviceInfo?: DeviceInfo;
    ipAddress: string;
    userAgent: string;
    expiresIn?: number;
    metadata?: Record<string, any>;
    securityFlags?: Partial<SecurityFlags>;
}
export interface UpdateSessionData {
    lastAccessedAt?: Date;
    expiresAt?: Date;
    metadata?: Record<string, any>;
    securityFlags?: Partial<SecurityFlags>;
}
export interface SessionValidationResult {
    valid: boolean;
    session?: Session;
    user?: User;
    reason?: string;
    requiresRefresh?: boolean;
    securityWarnings?: string[];
}
export interface Token {
    id: string;
    type: TokenType;
    value: string;
    userId: string;
    sessionId?: string;
    name?: string;
    description?: string;
    permissions?: string[];
    scopes?: string[];
    createdAt: Date;
    expiresAt?: Date;
    lastUsedAt?: Date;
    isActive: boolean;
    metadata?: Record<string, any>;
    rateLimit?: RateLimit;
}
export type TokenType = 'access' | 'refresh' | 'api_key' | 'temporary' | 'service';
export interface RateLimit {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    currentMinute: number;
    currentHour: number;
    currentDay: number;
    resetAt: Date;
}
export interface CreateTokenData {
    type: TokenType;
    userId: string;
    sessionId?: string;
    name?: string;
    description?: string;
    permissions?: string[];
    scopes?: string[];
    expiresIn?: number;
    metadata?: Record<string, any>;
    rateLimit?: Partial<RateLimit>;
}
export interface TokenValidationResult {
    valid: boolean;
    token?: Token;
    user?: User;
    session?: Session;
    reason?: string;
    rateLimitExceeded?: boolean;
    remainingRequests?: number;
}
export interface JWTPayload {
    sub: string;
    sid?: string;
    iat: number;
    exp: number;
    aud: string;
    iss: string;
    jti: string;
    type: TokenType;
    permissions?: string[];
    scopes?: string[];
    deviceId?: string;
    metadata?: Record<string, any>;
}
export interface JWTHeader {
    alg: string;
    typ: string;
    kid?: string;
}
export interface JWTOptions {
    algorithm?: string;
    expiresIn?: string | number;
    audience?: string;
    issuer?: string;
    subject?: string;
    keyId?: string;
}
export interface SessionSecurityEvent {
    sessionId: string;
    userId: string;
    type: SecurityEventType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export type SecurityEventType = 'login_success' | 'login_failure' | 'logout' | 'session_expired' | 'session_hijack_attempt' | 'suspicious_location' | 'multiple_concurrent_sessions' | 'token_theft_attempt' | 'rate_limit_exceeded' | 'privilege_escalation_attempt';
export interface SessionPolicy {
    maxConcurrentSessions: number;
    sessionTimeout: number;
    idleTimeout: number;
    requireSecureConnection: boolean;
    allowMultipleDevices: boolean;
    enforceGeoRestrictions: boolean;
    allowedCountries?: string[];
    blockedCountries?: string[];
    requireMFAForElevated: boolean;
    maxFailedAttempts: number;
    lockoutDuration: number;
}
export interface SessionStats {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageSessionDuration: number;
    sessionsByDevice: Record<string, number>;
    sessionsByLocation: Record<string, number>;
    peakConcurrentSessions: number;
    securityEvents: number;
    suspiciousSessions: number;
}
export interface UserSessionActivity {
    userId: string;
    totalSessions: number;
    activeSessions: number;
    lastLoginAt?: Date;
    averageSessionDuration: number;
    deviceCount: number;
    locationCount: number;
    securityScore: number;
    recentActivity: SessionActivity[];
}
export interface SessionActivity {
    sessionId: string;
    action: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    location?: GeoLocation;
    metadata?: Record<string, any>;
}
export interface SessionCleanupResult {
    expiredSessionsRemoved: number;
    inactiveSessionsRemoved: number;
    suspiciousSessionsRemoved: number;
    tokensRevoked: number;
    totalCleaned: number;
    errors: string[];
}
export interface SessionMaintenanceConfig {
    cleanupInterval: number;
    expiredSessionRetention: number;
    inactiveSessionThreshold: number;
    suspiciousSessionThreshold: number;
    enableAutoCleanup: boolean;
    enableSecurityMonitoring: boolean;
}
