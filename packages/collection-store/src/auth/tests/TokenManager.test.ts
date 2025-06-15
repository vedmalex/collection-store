// TokenManager Tests for Collection Store Auth System
// Basic functionality tests

import { describe, it, expect, beforeEach } from 'bun:test'
import { CSDatabase } from '../../core/Database'
import { TokenManager } from '../core/TokenManager'
import { TEST_AUTH_CONFIG } from '../config/defaults'
import { User } from '../interfaces/types'

describe('TokenManager', () => {
  let database: CSDatabase
  let tokenManager: TokenManager
  let testUser: User

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new CSDatabase(':memory:', 'test-auth')
    await database.connect()

    // Initialize TokenManager with test config
    tokenManager = new TokenManager(database, TEST_AUTH_CONFIG.jwt)

    // Create test user
    testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      roles: ['user', 'test'],
      attributes: { department: 'engineering' },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
  })

  describe('Token Generation', () => {
    it('should generate token pair successfully', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)

      expect(tokenPair).toBeDefined()
      expect(tokenPair.accessToken).toBeString()
      expect(tokenPair.refreshToken).toBeString()
      expect(tokenPair.tokenType).toBe('Bearer')
      expect(tokenPair.accessTokenExpiresAt).toBeInstanceOf(Date)
      expect(tokenPair.refreshTokenExpiresAt).toBeInstanceOf(Date)
    })

    it('should generate access token successfully', async () => {
      const accessToken = await tokenManager.generateAccessToken(testUser)

      expect(accessToken).toBeString()
      expect(accessToken.length).toBeGreaterThan(0)
    })

    it('should generate refresh token successfully', async () => {
      const refreshToken = await tokenManager.generateRefreshToken(testUser)

      expect(refreshToken).toBeString()
      expect(refreshToken.length).toBeGreaterThan(0)
    })

    it('should generate API key successfully', async () => {
      const apiKeyInfo = await tokenManager.generateApiKey(testUser, 'test-api-key')

      expect(apiKeyInfo).toBeDefined()
      expect(apiKeyInfo.id).toBeString()
      expect(apiKeyInfo.name).toBe('test-api-key')
      expect(apiKeyInfo.key).toBeString()
      expect(apiKeyInfo.userId).toBe(testUser.id)
      expect(apiKeyInfo.isActive).toBe(true)
    })
  })

  describe('Token Validation', () => {
    it('should validate access token successfully', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)
      const validation = await tokenManager.validateAccessToken(tokenPair.accessToken)

      expect(validation.valid).toBe(true)
      expect(validation.expired).toBe(false)
      expect(validation.issuedAt).toBeInstanceOf(Date)
      expect(validation.expiresAt).toBeInstanceOf(Date)
    })

    it('should validate refresh token successfully', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)
      const validation = await tokenManager.validateRefreshToken(tokenPair.refreshToken)

      expect(validation.valid).toBe(true)
      expect(validation.expired).toBe(false)
    })

    it('should validate API key successfully', async () => {
      const apiKeyInfo = await tokenManager.generateApiKey(testUser, 'test-api-key')
      const validation = await tokenManager.validateApiKey(apiKeyInfo.key)

      expect(validation.valid).toBe(true)
      expect(validation.expired).toBe(false)
      expect(validation.reason).toBe('Valid API key')
    })

    it('should reject invalid token', async () => {
      const validation = await tokenManager.validateAccessToken('invalid-token')

      expect(validation.valid).toBe(false)
      expect(validation.reason).toContain('Token validation failed')
    })
  })

  describe('Token Metadata', () => {
    it('should extract token metadata correctly', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)
      const metadata = await tokenManager.getTokenMetadata(tokenPair.accessToken)

      expect(metadata).toBeDefined()
      expect(metadata!.userId).toBe(testUser.id)
      expect(metadata!.tokenType).toBe('access')
      expect(metadata!.algorithm).toBe(TEST_AUTH_CONFIG.jwt.algorithm)
    })

    it('should extract token claims correctly', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)
      const claims = await tokenManager.getTokenClaims(tokenPair.accessToken)

      expect(claims).toBeDefined()
      expect(claims!.sub).toBe(testUser.id)
      expect(claims!.type).toBe('access')
      expect(claims!.scope).toEqual(testUser.roles)
    })
  })

  describe('Configuration', () => {
    it('should validate key configuration', async () => {
      const validation = await tokenManager.validateKeyConfiguration()

      expect(validation.valid).toBe(true)
      expect(validation.algorithm).toBe(TEST_AUTH_CONFIG.jwt.algorithm)
      expect(validation.keyType).toBe('symmetric')
      expect(validation.errors).toHaveLength(0)
    })

    it('should test token generation', async () => {
      const testResult = await tokenManager.testTokenGeneration()

      expect(testResult.success).toBe(true)
      expect(testResult.accessToken).toBeString()
      expect(testResult.refreshToken).toBeString()
      expect(testResult.validationResult?.valid).toBe(true)
      expect(testResult.performance.generationTime).toBeGreaterThanOrEqual(0)
      expect(testResult.performance.validationTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Token Expiration', () => {
    it('should check token expiration correctly', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)
      const isExpired = await tokenManager.isTokenExpired(tokenPair.accessToken)

      expect(isExpired).toBe(false)
    })

    it('should get token expiration time', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testUser)
      const expirationTime = await tokenManager.getTokenExpiration(tokenPair.accessToken)

      expect(expirationTime).toBeInstanceOf(Date)
      expect(expirationTime!.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('Statistics', () => {
    it('should get token statistics', async () => {
      const stats = await tokenManager.getTokenStats()

      expect(stats).toBeDefined()
      expect(stats.tokensByType).toBeDefined()
      expect(stats.tokensByAlgorithm).toBeDefined()
      expect(stats.averageTokenLifetime).toBeNumber()
    })

    it('should get token metrics', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      }
      const metrics = await tokenManager.getTokenMetrics(timeRange)

      expect(metrics).toBeDefined()
      expect(metrics.timeRange).toEqual(timeRange)
      expect(metrics.tokensGenerated).toBeNumber()
      expect(metrics.tokensValidated).toBeNumber()
    })
  })
})