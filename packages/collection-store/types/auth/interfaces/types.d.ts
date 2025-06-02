import { Item } from '../../types/Item';
export interface User extends Item {
    id: string;
    email: string;
    passwordHash: string;
    roles: string[];
    attributes: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    isActive: boolean;
    firstName?: string;
    lastName?: string;
    department?: string;
    failedLoginAttempts?: number;
    lockedUntil?: Date;
    passwordChangedAt?: Date;
    mustChangePassword?: boolean;
}
export interface Role extends Item {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
    parentRoles: string[];
    isSystemRole: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}
export interface Permission {
    resource: string;
    action: string;
    conditions?: string[];
    scope?: PermissionScope;
}
export interface PermissionScope {
    type: 'global' | 'database' | 'collection' | 'document' | 'field';
    target?: string;
    filters?: Record<string, any>;
}
export interface Session extends Item {
    id: string;
    userId: string;
    createdAt: Date;
    lastAccessAt: Date;
    expiresAt: Date;
    data: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    nodeId?: string;
    isActive: boolean;
}
export interface AuditLog extends Item {
    id: string;
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'denied';
    context: AuthContext;
    details?: Record<string, any>;
    executionTime?: number;
    requestId?: string;
    correlationId?: string;
}
export interface AuthCredentials {
    type: 'email_password' | 'oauth' | 'api_key' | 'external';
    email?: string;
    password?: string;
    oauthToken?: string;
    apiKey?: string;
    externalUserId?: string;
    context?: AuthContext;
}
export interface AuthContext {
    ip: string;
    userAgent: string;
    region?: string;
    timestamp: number;
    requestId?: string;
    correlationId?: string;
    customAttributes?: Record<string, any>;
}
export interface AuthResult {
    success: boolean;
    user?: User;
    tokens?: TokenPair;
    reason?: string;
    requiresPasswordChange?: boolean;
    requiresMFA?: boolean;
    attemptsRemaining?: number;
    lockoutUntil?: Date;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
    tokenType: 'Bearer';
}
export interface TokenValidation {
    valid: boolean;
    expired: boolean;
    user?: User;
    session?: Session;
    reason?: string;
    issuedAt?: Date;
    expiresAt?: Date;
    issuer?: string;
    audience?: string;
}
export interface AuthConfig {
    jwt: JWTConfig;
    password: PasswordConfig;
    session: SessionConfig;
    security: SecurityConfig;
    audit: AuditConfig;
    external?: ExternalAuthConfig;
}
export interface JWTConfig {
    algorithm: 'ES256' | 'RS256' | 'HS256';
    accessTokenTTL: number;
    refreshTokenTTL: number;
    rotateRefreshTokens: boolean;
    publicKey?: string;
    privateKey?: string;
    secret?: string;
    issuer: string;
    audience: string;
    enableRevocation: boolean;
    maxConcurrentSessions: number;
    requireSecureContext: boolean;
}
export interface PasswordConfig {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
    preventReuse: number;
    saltRounds: number;
}
export interface SessionConfig {
    ttl: number;
    extendOnActivity: boolean;
    maxConcurrentSessions: number;
    cleanupInterval: number;
    cleanupBatchSize: number;
}
export interface SecurityConfig {
    maxLoginAttempts: number;
    lockoutDuration: number;
    allowedIPs?: string[];
    blockedIPs?: string[];
    allowedTimeRanges?: TimeRange[];
    corsOrigins?: string[];
}
export interface TimeRange {
    start: string;
    end: string;
    timezone?: string;
    daysOfWeek?: number[];
}
export interface AuditConfig {
    enabled: boolean;
    retention: {
        type: 'time' | 'count';
        value: number;
    };
    logLevel: 'minimal' | 'standard' | 'detailed';
    batchSize: number;
    flushInterval: number;
    useWAL: boolean;
    compression: boolean;
}
export interface ExternalAuthConfig {
    providers: ExternalAuthProvider[];
    defaultProvider?: string;
    fallbackToLocal: boolean;
}
export interface ExternalAuthProvider {
    id: string;
    name: string;
    type: 'oauth2' | 'saml' | 'ldap' | 'custom';
    config: Record<string, any>;
    enabled: boolean;
    userMapping: {
        email: string;
        firstName?: string;
        lastName?: string;
        roles?: string[];
        attributes?: Record<string, string>;
    };
}
export interface ResourceDescriptor {
    type: 'database' | 'collection' | 'document' | 'field';
    database?: string;
    collection?: string;
    documentId?: string;
    fieldPath?: string;
    metadata?: Record<string, any>;
}
export interface AuthorizationResult {
    allowed: boolean;
    reason: string;
    appliedRules: string[];
    cacheHit: boolean;
    evaluationTime: number;
    rulesEvaluated: number;
}
export interface DynamicRule {
    id: string;
    name: string;
    priority: number;
    type: 'allow' | 'deny';
    evaluator: (user: User, resource: any, context: AuthContext) => Promise<boolean>;
    description: string;
    createdBy: string;
    createdAt: Date;
    isActive: boolean;
    timeout?: number;
    cacheResult?: boolean;
    cacheTTL?: number;
}
export declare class AuthError extends Error {
    code: string;
    statusCode: number;
    details?: Record<string, any>;
    constructor(message: string, code: string, statusCode?: number, details?: Record<string, any>);
}
export declare class AuthorizationError extends AuthError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class TokenError extends AuthError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class ValidationError extends AuthError {
    constructor(message: string, details?: Record<string, any>);
}
export type CreateUserData = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'passwordHash'> & {
    password: string;
};
export type UpdateUserData = Partial<Omit<User, 'id' | 'createdAt' | 'passwordHash'>>;
export type CreateRoleData = Omit<Role, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateRoleData = Partial<Omit<Role, 'id' | 'createdAt'>>;
export interface UserSchema {
    id: {
        type: 'string';
        required: true;
        unique: true;
    };
    email: {
        type: 'string';
        required: true;
        unique: true;
    };
    passwordHash: {
        type: 'string';
        required: true;
    };
    roles: {
        type: 'array';
        items: {
            type: 'string';
        };
        default: [];
    };
    attributes: {
        type: 'object';
        default: {};
    };
    createdAt: {
        type: 'date';
        required: true;
        default: 'now';
    };
    updatedAt: {
        type: 'date';
        required: true;
        default: 'now';
    };
    lastLoginAt: {
        type: 'date';
        required: false;
    };
    isActive: {
        type: 'boolean';
        required: true;
        default: true;
    };
    firstName: {
        type: 'string';
        required: false;
    };
    lastName: {
        type: 'string';
        required: false;
    };
    department: {
        type: 'string';
        required: false;
    };
    failedLoginAttempts: {
        type: 'number';
        default: 0;
    };
    lockedUntil: {
        type: 'date';
        required: false;
    };
    passwordChangedAt: {
        type: 'date';
        required: false;
    };
    mustChangePassword: {
        type: 'boolean';
        default: false;
    };
}
export interface RoleSchema {
    id: {
        type: 'string';
        required: true;
        unique: true;
    };
    name: {
        type: 'string';
        required: true;
        unique: true;
    };
    description: {
        type: 'string';
        required: true;
    };
    permissions: {
        type: 'array';
        items: {
            type: 'object';
        };
        default: [];
    };
    parentRoles: {
        type: 'array';
        items: {
            type: 'string';
        };
        default: [];
    };
    isSystemRole: {
        type: 'boolean';
        required: true;
        default: false;
    };
    createdAt: {
        type: 'date';
        required: true;
        default: 'now';
    };
    updatedAt: {
        type: 'date';
        required: true;
        default: 'now';
    };
    createdBy: {
        type: 'string';
        required: true;
    };
}
export interface SessionSchema {
    id: {
        type: 'string';
        required: true;
        unique: true;
    };
    userId: {
        type: 'string';
        required: true;
        index: true;
    };
    createdAt: {
        type: 'date';
        required: true;
        default: 'now';
    };
    lastAccessAt: {
        type: 'date';
        required: true;
        default: 'now';
    };
    expiresAt: {
        type: 'date';
        required: true;
        index: true;
    };
    data: {
        type: 'object';
        default: {};
    };
    ipAddress: {
        type: 'string';
        required: true;
    };
    userAgent: {
        type: 'string';
        required: true;
    };
    nodeId: {
        type: 'string';
        required: false;
    };
    isActive: {
        type: 'boolean';
        required: true;
        default: true;
    };
}
export interface AuditLogSchema {
    id: {
        type: 'string';
        required: true;
        unique: true;
    };
    timestamp: {
        type: 'date';
        required: true;
        default: 'now';
        index: true;
    };
    userId: {
        type: 'string';
        required: false;
        index: true;
    };
    sessionId: {
        type: 'string';
        required: false;
        index: true;
    };
    action: {
        type: 'string';
        required: true;
        index: true;
    };
    resource: {
        type: 'string';
        required: true;
        index: true;
    };
    result: {
        type: 'string';
        required: true;
        enum: ['success', 'failure', 'denied'];
    };
    context: {
        type: 'object';
        required: true;
    };
    details: {
        type: 'object';
        required: false;
    };
    executionTime: {
        type: 'number';
        required: false;
    };
    requestId: {
        type: 'string';
        required: false;
        index: true;
    };
    correlationId: {
        type: 'string';
        required: false;
        index: true;
    };
}
