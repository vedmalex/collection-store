// Token Management Interface for Collection Store Auth System
// Supports ES256, RS256, HS256 algorithms with refresh token rotation

import { User, TokenPair, TokenValidation, AuthContext, JWTConfig } from './types'

export interface ITokenManager {
  // ============================================================================
  // Token Generation
  // ============================================================================

  /**
   * Generate access and refresh token pair for user
   */
  generateTokenPair(user: User, context?: AuthContext): Promise<TokenPair>

  /**
   * Generate access token only
   */
  generateAccessToken(user: User, context?: AuthContext): Promise<string>

  /**
   * Generate refresh token only
   */
  generateRefreshToken(user: User, context?: AuthContext): Promise<string>

  /**
   * Generate API key token (long-lived)
   */
  generateApiKey(user: User, name: string, expiresAt?: Date): Promise<ApiKeyInfo>

  // ============================================================================
  // Token Validation
  // ============================================================================

  /**
   * Validate and decode access token
   */
  validateAccessToken(token: string): Promise<TokenValidation>

  /**
   * Validate and decode refresh token
   */
  validateRefreshToken(token: string): Promise<TokenValidation>

  /**
   * Validate API key token
   */
  validateApiKey(apiKey: string): Promise<TokenValidation>

  /**
   * Quick token validation (without full decode)
   */
  isTokenValid(token: string): Promise<boolean>

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): Promise<boolean>

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Promise<Date | null>

  // ============================================================================
  // Token Refresh
  // ============================================================================

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string): Promise<TokenPair>

  /**
   * Rotate refresh token (generate new refresh token)
   */
  rotateRefreshToken(refreshToken: string): Promise<string>

  /**
   * Refresh token pair (both access and refresh)
   */
  refreshTokenPair(refreshToken: string): Promise<TokenPair>

  // ============================================================================
  // Token Revocation
  // ============================================================================

  /**
   * Revoke specific token
   */
  revokeToken(tokenId: string): Promise<void>

  /**
   * Revoke all tokens for user
   */
  revokeUserTokens(userId: string): Promise<void>

  /**
   * Revoke all tokens for session
   */
  revokeSessionTokens(sessionId: string): Promise<void>

  /**
   * Check if token is revoked
   */
  isTokenRevoked(tokenId: string): Promise<boolean>

  /**
   * Revoke expired tokens (cleanup)
   */
  revokeExpiredTokens(): Promise<number>

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Get active sessions for user
   */
  getUserSessions(userId: string): Promise<TokenSession[]>

  /**
   * Get session by token
   */
  getTokenSession(token: string): Promise<TokenSession | null>

  /**
   * Limit concurrent sessions per user
   */
  enforceConcurrentSessionLimit(userId: string): Promise<void>

  /**
   * Terminate session
   */
  terminateSession(sessionId: string): Promise<void>

  /**
   * Terminate all user sessions except current
   */
  terminateOtherSessions(userId: string, currentSessionId: string): Promise<void>

  // ============================================================================
  // Token Metadata
  // ============================================================================

  /**
   * Get token metadata without validation
   */
  getTokenMetadata(token: string): Promise<TokenMetadata | null>

  /**
   * Get token claims
   */
  getTokenClaims(token: string): Promise<TokenClaims | null>

  /**
   * Get token header information
   */
  getTokenHeader(token: string): Promise<TokenHeader | null>

  // ============================================================================
  // Key Management
  // ============================================================================

  /**
   * Rotate signing keys (for RS256/ES256)
   */
  rotateSigningKeys(): Promise<void>

  /**
   * Get current public key (for verification)
   */
  getPublicKey(): Promise<string | null>

  /**
   * Get key ID for current signing key
   */
  getCurrentKeyId(): Promise<string>

  /**
   * Validate key configuration
   */
  validateKeyConfiguration(): Promise<KeyValidationResult>

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update JWT configuration
   */
  updateConfiguration(config: Partial<JWTConfig>): Promise<void>

  /**
   * Get current configuration
   */
  getConfiguration(): Promise<JWTConfig>

  /**
   * Test token generation with current config
   */
  testTokenGeneration(): Promise<TokenTestResult>

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Get token statistics
   */
  getTokenStats(): Promise<TokenStats>

  /**
   * Get token usage metrics
   */
  getTokenMetrics(timeRange: TimeRange): Promise<TokenMetrics>

  /**
   * Get revoked tokens count
   */
  getRevokedTokensCount(): Promise<number>
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ApiKeyInfo {
  id: string
  name: string
  key: string
  userId: string
  createdAt: Date
  expiresAt?: Date
  lastUsedAt?: Date
  isActive: boolean
}

export interface TokenSession {
  id: string
  userId: string
  tokenId: string
  createdAt: Date
  lastAccessAt: Date
  expiresAt: Date
  ipAddress: string
  userAgent: string
  isActive: boolean
  data: Record<string, any> // Required by Session interface
}

export interface TokenMetadata {
  tokenId: string
  userId: string
  sessionId?: string
  issuedAt: Date
  expiresAt: Date
  algorithm: string
  tokenType: 'access' | 'refresh' | 'api_key'
}

export interface TokenClaims {
  sub: string // user ID
  iat: number // issued at
  exp: number // expires at
  iss: string // issuer
  aud: string // audience
  jti: string // token ID
  sid?: string // session ID
  scope?: string[] // permissions/scopes
  [key: string]: any // custom claims
}

export interface TokenHeader {
  alg: string // algorithm
  typ: string // token type
  kid?: string // key ID
}

export interface KeyValidationResult {
  valid: boolean
  algorithm: string
  keyType: string
  keySize?: number
  errors: string[]
  warnings: string[]
}

export interface TokenTestResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  validationResult?: TokenValidation
  error?: string
  performance: {
    generationTime: number // ms
    validationTime: number // ms
  }
}

export interface TokenStats {
  totalTokensIssued: number
  activeTokens: number
  revokedTokens: number
  expiredTokens: number
  tokensByType: {
    access: number
    refresh: number
    apiKey: number
  }
  tokensByAlgorithm: Record<string, number>
  averageTokenLifetime: number // seconds
}

export interface TokenMetrics {
  timeRange: TimeRange
  tokensGenerated: number
  tokensValidated: number
  tokensRevoked: number
  validationErrors: number
  averageGenerationTime: number // ms
  averageValidationTime: number // ms
  peakConcurrentTokens: number
  uniqueUsers: number
}

export interface TimeRange {
  start: Date
  end: Date
}

// ============================================================================
// Token Storage Interface (for revocation and session management)
// ============================================================================

export interface ITokenStorage {
  /**
   * Store token metadata for revocation tracking
   */
  storeToken(metadata: TokenMetadata): Promise<void>

  /**
   * Get token metadata
   */
  getToken(tokenId: string): Promise<TokenMetadata | null>

  /**
   * Mark token as revoked
   */
  revokeToken(tokenId: string): Promise<void>

  /**
   * Check if token is revoked
   */
  isRevoked(tokenId: string): Promise<boolean>

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): Promise<number>

  /**
   * Get user tokens
   */
  getUserTokens(userId: string): Promise<TokenMetadata[]>

  /**
   * Revoke user tokens
   */
  revokeUserTokens(userId: string): Promise<void>
}