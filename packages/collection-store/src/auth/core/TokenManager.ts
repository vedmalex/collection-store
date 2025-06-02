// Token Manager Implementation for Collection Store Auth System
// Handles JWT token generation, validation, and management

import { CSDatabase } from '../../CSDatabase'
import { IDataCollection } from '../../IDataCollection'
import {
  ITokenManager,
  ITokenStorage,
  TokenPair,
  TokenValidation,
  TokenSession,
  TokenMetadata,
  TokenClaims,
  TokenHeader,
  ApiKeyInfo,
  KeyValidationResult,
  TokenTestResult,
  TokenStats,
  TokenMetrics,
  User,
  AuthContext,
  JWTConfig
} from '../interfaces'
import { TimeRange } from '../interfaces/ITokenManager'
import {
  signJWT,
  verifyJWT,
  decodeJWT,
  getTokenExpiration,
  isTokenExpired,
  generateId,
  generateApiKey,
  generateKeyPair,
  validateJWTKeys
} from '../utils'
import {
  createExpiredTokenError,
  createInvalidTokenError,
  createConfigurationError,
  withErrorHandling
} from '../utils'

// Using TimeRange from interfaces

export class TokenManager implements ITokenManager {
  private database: CSDatabase
  private config: JWTConfig
  private tokenStorage: ITokenStorage
  private sessionsCollection?: IDataCollection<TokenSession>
  private apiKeysCollection?: IDataCollection<ApiKeyInfo>
  private initialized = false

  constructor(database: CSDatabase, config: JWTConfig) {
    this.database = database
    this.config = { ...config }
    this.tokenStorage = new TokenStorage(database)
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeCollections()
      this.initialized = true
    }
  }

  private async initializeCollections() {
    try {
      this.sessionsCollection = this.database.collection<TokenSession>('auth_sessions')
    } catch (error) {
      this.sessionsCollection = await this.database.createCollection<TokenSession>('auth_sessions')
    }

    try {
      this.apiKeysCollection = this.database.collection<ApiKeyInfo>('auth_api_keys')
    } catch (error) {
      this.apiKeysCollection = await this.database.createCollection<ApiKeyInfo>('auth_api_keys')
    }
  }

  // ============================================================================
  // Token Generation
  // ============================================================================

  async generateTokenPair(user: User, context?: AuthContext): Promise<TokenPair> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const sessionId = generateId()
      const accessTokenId = generateId()
      const refreshTokenId = generateId()

      const now = new Date()
      const accessTokenExpiresAt = new Date(now.getTime() + this.config.accessTokenTTL * 1000)
      const refreshTokenExpiresAt = new Date(now.getTime() + this.config.refreshTokenTTL * 1000)

      // Create access token
      const accessTokenPayload = {
        sub: user.id,
        sid: sessionId,
        jti: accessTokenId,
        scope: this.getUserScope(user),
        type: 'access'
      }

      const accessToken = signJWT(accessTokenPayload, this.config, {
        expiresIn: this.config.accessTokenTTL
      })

      // Create refresh token
      const refreshTokenPayload = {
        sub: user.id,
        sid: sessionId,
        jti: refreshTokenId,
        type: 'refresh'
      }

      const refreshToken = signJWT(refreshTokenPayload, this.config, {
        expiresIn: this.config.refreshTokenTTL
      })

      // Store token metadata
      await Promise.all([
        this.tokenStorage.storeToken({
          tokenId: accessTokenId,
          userId: user.id,
          sessionId,
          issuedAt: now,
          expiresAt: accessTokenExpiresAt,
          algorithm: this.config.algorithm,
          tokenType: 'access'
        }),
        this.tokenStorage.storeToken({
          tokenId: refreshTokenId,
          userId: user.id,
          sessionId,
          issuedAt: now,
          expiresAt: refreshTokenExpiresAt,
          algorithm: this.config.algorithm,
          tokenType: 'refresh'
        })
      ])

      // Create session
      await this.createSession({
        id: sessionId,
        userId: user.id,
        tokenId: accessTokenId,
        createdAt: now,
        lastAccessAt: now,
        expiresAt: refreshTokenExpiresAt,
        ipAddress: context?.ip || 'unknown',
        userAgent: context?.userAgent || 'unknown',
        isActive: true,
        data: {} // Required by Session interface
      })

      // Enforce concurrent session limit
      if (this.config.maxConcurrentSessions > 0) {
        await this.enforceConcurrentSessionLimit(user.id)
      }

      return {
        accessToken,
        refreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        tokenType: 'Bearer' as const
      }
    })()
  }

  async generateAccessToken(user: User, context?: AuthContext): Promise<string> {
    return withErrorHandling(async () => {
      const tokenId = generateId()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + this.config.accessTokenTTL * 1000)

      const payload = {
        sub: user.id,
        jti: tokenId,
        scope: this.getUserScope(user),
        type: 'access'
      }

      const token = signJWT(payload, this.config, {
        expiresIn: this.config.accessTokenTTL
      })

      // Store token metadata
      await this.tokenStorage.storeToken({
        tokenId,
        userId: user.id,
        issuedAt: now,
        expiresAt,
        algorithm: this.config.algorithm,
        tokenType: 'access'
      })

      return token
    })()
  }

  async generateRefreshToken(user: User, context?: AuthContext): Promise<string> {
    return withErrorHandling(async () => {
      const tokenId = generateId()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + this.config.refreshTokenTTL * 1000)

      const payload = {
        sub: user.id,
        jti: tokenId,
        type: 'refresh'
      }

      const token = signJWT(payload, this.config, {
        expiresIn: this.config.refreshTokenTTL
      })

      // Store token metadata
      await this.tokenStorage.storeToken({
        tokenId,
        userId: user.id,
        issuedAt: now,
        expiresAt,
        algorithm: this.config.algorithm,
        tokenType: 'refresh'
      })

      return token
    })()
  }

  async generateApiKey(user: User, name: string, expiresAt?: Date): Promise<ApiKeyInfo> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const apiKey = generateApiKey('cs')
      const now = new Date()

      const apiKeyInfo: ApiKeyInfo = {
        id: generateId(),
        name,
        key: apiKey,
        userId: user.id,
        createdAt: now,
        expiresAt,
        isActive: true
      }

      await this.apiKeysCollection!.create(apiKeyInfo)
      return apiKeyInfo
    })()
  }

  // ============================================================================
  // Token Validation
  // ============================================================================

  async validateAccessToken(token: string): Promise<TokenValidation> {
    return this.validateToken(token, 'access')
  }

  async validateRefreshToken(token: string): Promise<TokenValidation> {
    return this.validateToken(token, 'refresh')
  }

  async validateApiKey(apiKey: string): Promise<TokenValidation> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()

      const keyInfo = await this.apiKeysCollection!.findFirst({ key: apiKey } as any)

      if (!keyInfo) {
        return {
          valid: false,
          expired: false,
          reason: 'API key not found'
        }
      }

      if (!keyInfo.isActive) {
        return {
          valid: false,
          expired: false,
          reason: 'API key is disabled'
        }
      }

      if (keyInfo.expiresAt && keyInfo.expiresAt <= new Date()) {
        return {
          valid: false,
          expired: true,
          reason: 'API key has expired'
        }
      }

      // Update last used time
      await this.apiKeysCollection!.updateWithId(keyInfo.id, {
        lastUsedAt: new Date()
      })

      return {
        valid: true,
        expired: false,
        reason: 'Valid API key'
      }
    })()
  }

  private async validateToken(token: string, expectedType?: string): Promise<TokenValidation> {
    return withErrorHandling(async () => {
      try {
        // Decode token to get claims
        const claims = verifyJWT(token, this.config)

        // Check token type if specified
        if (expectedType && claims.type !== expectedType) {
          return {
            valid: false,
            expired: false,
            reason: `Expected ${expectedType} token, got ${claims.type}`
          }
        }

        // Check if token is revoked
        if (this.config.enableRevocation && claims.jti) {
          const isRevoked = await this.tokenStorage.isRevoked(claims.jti)
          if (isRevoked) {
            return {
              valid: false,
              expired: false,
              reason: 'Token has been revoked'
            }
          }
        }

        // Get session if available
        let session: TokenSession | undefined
        if (claims.sid) {
          await this.ensureInitialized()
          session = await this.sessionsCollection!.findFirst({ id: claims.sid } as any)
          if (session && !session.isActive) {
            return {
              valid: false,
              expired: false,
              reason: 'Session is no longer active'
            }
          }
        }

        return {
          valid: true,
          expired: false,
          session,
          issuedAt: new Date(claims.iat * 1000),
          expiresAt: new Date(claims.exp * 1000),
          issuer: claims.iss,
          audience: claims.aud
        }

      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          return {
            valid: false,
            expired: true,
            reason: 'Token has expired'
          }
        }

        return {
          valid: false,
          expired: false,
          reason: `Token validation failed: ${error.message}`
        }
      }
    })()
  }

  async isTokenValid(token: string): Promise<boolean> {
    const validation = await this.validateAccessToken(token)
    return validation.valid
  }

  async isTokenExpired(token: string): Promise<boolean> {
    return isTokenExpired(token)
  }

  async getTokenExpiration(token: string): Promise<Date | null> {
    return getTokenExpiration(token)
  }

  // ============================================================================
  // Token Refresh
  // ============================================================================

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    return withErrorHandling(async () => {
      const validation = await this.validateRefreshToken(refreshToken)

      if (!validation.valid) {
        if (validation.expired) {
          throw createExpiredTokenError()
        }
        throw createInvalidTokenError(validation.reason)
      }

      const claims = decodeJWT(refreshToken)?.payload
      if (!claims) {
        throw createInvalidTokenError('Cannot decode refresh token')
      }

      // Get user (this would need to be injected or passed)
      // For now, we'll create a minimal user object
      const user = { id: claims.sub, roles: claims.scope || [] } as User

      // Generate new token pair
      const tokenPair = await this.generateTokenPair(user)

      // Revoke old refresh token if rotation is enabled
      if (this.config.rotateRefreshTokens && claims.jti) {
        await this.revokeToken(claims.jti)
      }

      return tokenPair
    })()
  }

  async rotateRefreshToken(refreshToken: string): Promise<string> {
    return withErrorHandling(async () => {
      const validation = await this.validateRefreshToken(refreshToken)

      if (!validation.valid) {
        if (validation.expired) {
          throw createExpiredTokenError()
        }
        throw createInvalidTokenError(validation.reason)
      }

      const claims = decodeJWT(refreshToken)?.payload
      if (!claims) {
        throw createInvalidTokenError('Cannot decode refresh token')
      }

      const user = { id: claims.sub, roles: claims.scope || [] } as User
      const newRefreshToken = await this.generateRefreshToken(user)

      // Revoke old refresh token
      if (claims.jti) {
        await this.revokeToken(claims.jti)
      }

      return newRefreshToken
    })()
  }

  async refreshTokenPair(refreshToken: string): Promise<TokenPair> {
    return this.refreshAccessToken(refreshToken)
  }

  // ============================================================================
  // Token Revocation
  // ============================================================================

  async revokeToken(tokenId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.tokenStorage.revokeToken(tokenId)
    })()
  }

  async revokeUserTokens(userId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.tokenStorage.revokeUserTokens(userId)

      // Deactivate user sessions
      await this.ensureInitialized()
      await this.sessionsCollection!.update(
        { userId } as any,
        { isActive: false }
      )
    })()
  }

  async revokeSessionTokens(sessionId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()
      const session = await this.sessionsCollection!.findFirst({ id: sessionId } as any)
      if (session) {
        // Revoke all tokens for this session
        const tokens = await this.tokenStorage.getUserTokens(session.userId)
        const sessionTokens = tokens.filter(t => t.sessionId === sessionId)

        await Promise.all(
          sessionTokens.map(token => this.tokenStorage.revokeToken(token.tokenId))
        )

        // Deactivate session
        await this.sessionsCollection!.updateWithId(sessionId, { isActive: false })
      }
    })()
  }

  async isTokenRevoked(tokenId: string): Promise<boolean> {
    return this.tokenStorage.isRevoked(tokenId)
  }

  async revokeExpiredTokens(): Promise<number> {
    return withErrorHandling(async () => {
      return await this.tokenStorage.cleanupExpiredTokens()
    })()
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async getUserSessions(userId: string): Promise<TokenSession[]> {
    return withErrorHandling(async () => {
      await this.ensureInitialized()
      return await this.sessionsCollection!.find({ userId, isActive: true } as any)
    })()
  }

  async getTokenSession(token: string): Promise<TokenSession | null> {
    return withErrorHandling(async () => {
      const claims = decodeJWT(token)?.payload
      if (!claims?.sid) {
        return null
      }

      await this.ensureInitialized()
      return await this.sessionsCollection!.findFirst({ id: claims.sid } as any) || null
    })()
  }

  async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    return withErrorHandling(async () => {
      if (this.config.maxConcurrentSessions <= 0) {
        return
      }

      const sessions = await this.getUserSessions(userId)

      if (sessions.length > this.config.maxConcurrentSessions) {
        // Sort by last access time and terminate oldest sessions
        sessions.sort((a, b) => a.lastAccessAt.getTime() - b.lastAccessAt.getTime())

        const sessionsToTerminate = sessions.slice(0, sessions.length - this.config.maxConcurrentSessions)

        await Promise.all(
          sessionsToTerminate.map(session => this.terminateSession(session.id))
        )
      }
    })()
  }

  async terminateSession(sessionId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.revokeSessionTokens(sessionId)
    })()
  }

  async terminateOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    return withErrorHandling(async () => {
      const sessions = await this.getUserSessions(userId)
      const otherSessions = sessions.filter(s => s.id !== currentSessionId)

      await Promise.all(
        otherSessions.map(session => this.terminateSession(session.id))
      )
    })()
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async createSession(session: TokenSession): Promise<void> {
    await this.ensureInitialized()
    await this.sessionsCollection!.create(session)
  }

  private getUserScope(user: User): string[] {
    // Convert user roles to scopes
    return user.roles || []
  }

  // ============================================================================
  // Token Metadata
  // ============================================================================

  async getTokenMetadata(token: string): Promise<TokenMetadata | null> {
    const decoded = decodeJWT(token)
    if (!decoded?.payload) {
      return null
    }

    const claims = decoded.payload
    return {
      tokenId: claims.jti || 'unknown',
      userId: claims.sub,
      sessionId: claims.sid,
      issuedAt: new Date(claims.iat * 1000),
      expiresAt: new Date(claims.exp * 1000),
      algorithm: decoded.header.alg,
      tokenType: claims.type || 'unknown'
    }
  }

  async getTokenClaims(token: string): Promise<TokenClaims | null> {
    const decoded = decodeJWT(token)
    return decoded?.payload || null
  }

  async getTokenHeader(token: string): Promise<TokenHeader | null> {
    const decoded = decodeJWT(token)
    return decoded?.header || null
  }

  // ============================================================================
  // Key Management
  // ============================================================================

  async rotateSigningKeys(): Promise<void> {
    return withErrorHandling(async () => {
      const newKeys = generateKeyPair(this.config.algorithm)

      // Update configuration with new keys
      this.config = {
        ...this.config,
        ...newKeys
      }
    })()
  }

  async getPublicKey(): Promise<string | null> {
    return this.config.publicKey || null
  }

  async getCurrentKeyId(): Promise<string> {
    // Generate a key ID based on the public key or secret
    const key = this.config.publicKey || this.config.secret || 'default'
    return key.substring(0, 8)
  }

  async validateKeyConfiguration(): Promise<KeyValidationResult> {
    const validation = validateJWTKeys(this.config)
    return {
      valid: validation.valid,
      algorithm: this.config.algorithm,
      keyType: this.config.algorithm.startsWith('HS') ? 'symmetric' : 'asymmetric',
      errors: validation.errors,
      warnings: []
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  async updateConfiguration(config: Partial<JWTConfig>): Promise<void> {
    return withErrorHandling(async () => {
      this.config = { ...this.config, ...config }

      // Validate new configuration
      const validation = await this.validateKeyConfiguration()
      if (!validation.valid) {
        throw createConfigurationError(
          `Invalid JWT configuration: ${validation.errors.join(', ')}`
        )
      }
    })()
  }

  async getConfiguration(): Promise<JWTConfig> {
    return { ...this.config }
  }

  async testTokenGeneration(): Promise<TokenTestResult> {
    return withErrorHandling(async () => {
      const startTime = Date.now()

      try {
        // Create test user
        const testUser: User = {
          id: 'test-user',
          email: 'test@example.com',
          passwordHash: 'test',
          roles: ['test'],
          attributes: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        }

        // Generate tokens
        const generationStart = Date.now()
        const tokenPair = await this.generateTokenPair(testUser)
        const generationTime = Date.now() - generationStart

        // Validate tokens
        const validationStart = Date.now()
        const validationResult = await this.validateAccessToken(tokenPair.accessToken)
        const validationTime = Date.now() - validationStart

        return {
          success: true,
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          validationResult,
          performance: {
            generationTime,
            validationTime
          }
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          performance: {
            generationTime: Date.now() - startTime,
            validationTime: 0
          }
        }
      }
    })()
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  async getTokenStats(): Promise<TokenStats> {
    return withErrorHandling(async () => {
      // This would need to be implemented based on actual storage
      // For now, return mock data
      return {
        totalTokensIssued: 0,
        activeTokens: 0,
        revokedTokens: 0,
        expiredTokens: 0,
        tokensByType: {
          access: 0,
          refresh: 0,
          apiKey: 0
        },
        tokensByAlgorithm: {
          [this.config.algorithm]: 0
        },
        averageTokenLifetime: this.config.accessTokenTTL
      }
    })()
  }

  async getTokenMetrics(timeRange: TimeRange): Promise<TokenMetrics> {
    return withErrorHandling(async () => {
      // This would need to be implemented based on actual metrics collection
      // For now, return mock data
      return {
        timeRange,
        tokensGenerated: 0,
        tokensValidated: 0,
        tokensRevoked: 0,
        validationErrors: 0,
        averageGenerationTime: 0,
        averageValidationTime: 0,
        peakConcurrentTokens: 0,
        uniqueUsers: 0
      }
    })()
  }

  async getRevokedTokensCount(): Promise<number> {
    return withErrorHandling(async () => {
      // This would need to be implemented based on actual storage
      return 0
    })()
  }
}

// ============================================================================
// Token Storage Implementation
// ============================================================================

class TokenStorage implements ITokenStorage {
  private tokensCollection?: IDataCollection<TokenMetadata>
  private revokedTokensCollection?: IDataCollection<{ id: string; tokenId: string; revokedAt: Date }>
  private database: CSDatabase
  private initialized = false

  constructor(database: CSDatabase) {
    this.database = database
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      try {
        this.tokensCollection = this.database.collection<TokenMetadata>('auth_tokens')
      } catch (error) {
        this.tokensCollection = await this.database.createCollection<TokenMetadata>('auth_tokens')
      }

      try {
        this.revokedTokensCollection = this.database.collection<{ id: string; tokenId: string; revokedAt: Date }>('auth_revoked_tokens')
      } catch (error) {
        this.revokedTokensCollection = await this.database.createCollection<{ id: string; tokenId: string; revokedAt: Date }>('auth_revoked_tokens')
      }

      this.initialized = true
    }
  }

  async storeToken(metadata: TokenMetadata): Promise<void> {
    await this.ensureInitialized()
    await this.tokensCollection!.create(metadata)
  }

  async getToken(tokenId: string): Promise<TokenMetadata | null> {
    await this.ensureInitialized()
    return await this.tokensCollection!.findFirst({ tokenId } as any) || null
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.ensureInitialized()
    await this.revokedTokensCollection!.create({
      id: generateId(),
      tokenId,
      revokedAt: new Date()
    })
  }

  async isRevoked(tokenId: string): Promise<boolean> {
    await this.ensureInitialized()
    const revoked = await this.revokedTokensCollection!.findFirst({ tokenId } as any)
    return !!revoked
  }

  async cleanupExpiredTokens(): Promise<number> {
    await this.ensureInitialized()
    const now = new Date()
    const expiredTokens = await this.tokensCollection!.find({
      expiresAt: { $lt: now }
    } as any)

    if (expiredTokens.length > 0) {
      await Promise.all(
        expiredTokens.map(token => this.tokensCollection!.removeWithId(token.tokenId))
      )
    }

    return expiredTokens.length
  }

  async getUserTokens(userId: string): Promise<TokenMetadata[]> {
    await this.ensureInitialized()
    return await this.tokensCollection!.find({ userId } as any)
  }

  async revokeUserTokens(userId: string): Promise<void> {
    const userTokens = await this.getUserTokens(userId)

    await Promise.all(
      userTokens.map(token => this.revokeToken(token.tokenId))
    )
  }
}