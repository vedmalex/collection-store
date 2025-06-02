import { User, TokenPair, TokenValidation, AuthContext, JWTConfig } from './types';
export interface ITokenManager {
    generateTokenPair(user: User, context?: AuthContext): Promise<TokenPair>;
    generateAccessToken(user: User, context?: AuthContext): Promise<string>;
    generateRefreshToken(user: User, context?: AuthContext): Promise<string>;
    generateApiKey(user: User, name: string, expiresAt?: Date): Promise<ApiKeyInfo>;
    validateAccessToken(token: string): Promise<TokenValidation>;
    validateRefreshToken(token: string): Promise<TokenValidation>;
    validateApiKey(apiKey: string): Promise<TokenValidation>;
    isTokenValid(token: string): Promise<boolean>;
    isTokenExpired(token: string): Promise<boolean>;
    getTokenExpiration(token: string): Promise<Date | null>;
    refreshAccessToken(refreshToken: string): Promise<TokenPair>;
    rotateRefreshToken(refreshToken: string): Promise<string>;
    refreshTokenPair(refreshToken: string): Promise<TokenPair>;
    revokeToken(tokenId: string): Promise<void>;
    revokeUserTokens(userId: string): Promise<void>;
    revokeSessionTokens(sessionId: string): Promise<void>;
    isTokenRevoked(tokenId: string): Promise<boolean>;
    revokeExpiredTokens(): Promise<number>;
    getUserSessions(userId: string): Promise<TokenSession[]>;
    getTokenSession(token: string): Promise<TokenSession | null>;
    enforceConcurrentSessionLimit(userId: string): Promise<void>;
    terminateSession(sessionId: string): Promise<void>;
    terminateOtherSessions(userId: string, currentSessionId: string): Promise<void>;
    getTokenMetadata(token: string): Promise<TokenMetadata | null>;
    getTokenClaims(token: string): Promise<TokenClaims | null>;
    getTokenHeader(token: string): Promise<TokenHeader | null>;
    rotateSigningKeys(): Promise<void>;
    getPublicKey(): Promise<string | null>;
    getCurrentKeyId(): Promise<string>;
    validateKeyConfiguration(): Promise<KeyValidationResult>;
    updateConfiguration(config: Partial<JWTConfig>): Promise<void>;
    getConfiguration(): Promise<JWTConfig>;
    testTokenGeneration(): Promise<TokenTestResult>;
    getTokenStats(): Promise<TokenStats>;
    getTokenMetrics(timeRange: TimeRange): Promise<TokenMetrics>;
    getRevokedTokensCount(): Promise<number>;
}
export interface ApiKeyInfo {
    id: string;
    name: string;
    key: string;
    userId: string;
    createdAt: Date;
    expiresAt?: Date;
    lastUsedAt?: Date;
    isActive: boolean;
}
export interface TokenSession {
    id: string;
    userId: string;
    tokenId: string;
    createdAt: Date;
    lastAccessAt: Date;
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
    data: Record<string, any>;
}
export interface TokenMetadata {
    tokenId: string;
    userId: string;
    sessionId?: string;
    issuedAt: Date;
    expiresAt: Date;
    algorithm: string;
    tokenType: 'access' | 'refresh' | 'api_key';
}
export interface TokenClaims {
    sub: string;
    iat: number;
    exp: number;
    iss: string;
    aud: string;
    jti: string;
    sid?: string;
    scope?: string[];
    [key: string]: any;
}
export interface TokenHeader {
    alg: string;
    typ: string;
    kid?: string;
}
export interface KeyValidationResult {
    valid: boolean;
    algorithm: string;
    keyType: string;
    keySize?: number;
    errors: string[];
    warnings: string[];
}
export interface TokenTestResult {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    validationResult?: TokenValidation;
    error?: string;
    performance: {
        generationTime: number;
        validationTime: number;
    };
}
export interface TokenStats {
    totalTokensIssued: number;
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    tokensByType: {
        access: number;
        refresh: number;
        apiKey: number;
    };
    tokensByAlgorithm: Record<string, number>;
    averageTokenLifetime: number;
}
export interface TokenMetrics {
    timeRange: TimeRange;
    tokensGenerated: number;
    tokensValidated: number;
    tokensRevoked: number;
    validationErrors: number;
    averageGenerationTime: number;
    averageValidationTime: number;
    peakConcurrentTokens: number;
    uniqueUsers: number;
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface ITokenStorage {
    storeToken(metadata: TokenMetadata): Promise<void>;
    getToken(tokenId: string): Promise<TokenMetadata | null>;
    revokeToken(tokenId: string): Promise<void>;
    isRevoked(tokenId: string): Promise<boolean>;
    cleanupExpiredTokens(): Promise<number>;
    getUserTokens(userId: string): Promise<TokenMetadata[]>;
    revokeUserTokens(userId: string): Promise<void>;
}
