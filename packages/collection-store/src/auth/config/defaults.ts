// Default Configuration for Collection Store Auth System
// Production-ready defaults with security best practices

import { AuthConfig } from '../interfaces/types'
import { generateKeyPair } from '../utils/crypto'

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate keys for JWT configuration based on algorithm
 */
export function generateJWTKeys(algorithm: 'ES256' | 'RS256' | 'HS256') {
  return generateKeyPair(algorithm)
}

/**
 * Get or generate keys for configuration
 */
function getOrGenerateKeys(algorithm: 'ES256' | 'RS256' | 'HS256') {
  // In production, keys should be loaded from secure storage
  // For development/testing, we generate them automatically
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // In production, require explicit key configuration
    return {
      publicKey: undefined,
      privateKey: undefined,
      secret: undefined
    }
  }

  // For development/testing, generate keys automatically
  return generateKeyPair(algorithm)
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default authentication configuration
 * Follows security best practices and enterprise requirements
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  // JWT Configuration
  jwt: {
    algorithm: 'ES256', // Most secure by default
    accessTokenTTL: 900, // 15 minutes
    refreshTokenTTL: 604800, // 7 days
    rotateRefreshTokens: true,

    // Key management (will be generated if not provided)
    ...getOrGenerateKeys('ES256'),

    // Token settings
    issuer: 'collection-store-auth',
    audience: 'collection-store-api',

    // Security
    enableRevocation: true,
    maxConcurrentSessions: 5,
    requireSecureContext: true // HTTPS required in production
  },

  // Password Policy
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,

    // Security
    maxAge: 90, // 90 days
    preventReuse: 5, // last 5 passwords

    // Hashing
    saltRounds: 12 // bcrypt rounds
  },

  // Session Management
  session: {
    ttl: 3600, // 1 hour
    extendOnActivity: true,
    maxConcurrentSessions: 5,

    // Cleanup
    cleanupInterval: 300, // 5 minutes
    cleanupBatchSize: 1000
  },

  // Security Settings
  security: {
    // Rate limiting
    maxLoginAttempts: 5,
    lockoutDuration: 300, // 5 minutes

    // IP restrictions (empty by default)
    allowedIPs: undefined,
    blockedIPs: undefined,

    // Time restrictions (none by default)
    allowedTimeRanges: undefined,

    // CORS (restrictive by default)
    corsOrigins: ['http://localhost:3000', 'http://localhost:8080']
  },

  // Audit Configuration
  audit: {
    enabled: true,
    retention: {
      type: 'time',
      value: 90 // 90 days
    },
    logLevel: 'standard',

    // Performance
    batchSize: 100,
    flushInterval: 30, // 30 seconds

    // Storage
    useWAL: true, // integrate with Collection Store WAL
    compression: true
  },

  // External Auth (disabled by default)
  external: undefined
}

/**
 * Development configuration with relaxed security
 * Should only be used in development environments
 */
export const DEVELOPMENT_AUTH_CONFIG: AuthConfig = {
  ...DEFAULT_AUTH_CONFIG,

  jwt: {
    ...DEFAULT_AUTH_CONFIG.jwt,
    algorithm: 'HS256', // Simpler for development
    accessTokenTTL: 3600, // 1 hour for easier development
    requireSecureContext: false, // Allow HTTP in development
    ...generateKeyPair('HS256') // Generate HS256 secret
  },

  password: {
    ...DEFAULT_AUTH_CONFIG.password,
    minLength: 6, // Shorter for development
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
    maxAge: 365, // 1 year
    preventReuse: 0 // No password reuse prevention
  },

  security: {
    ...DEFAULT_AUTH_CONFIG.security,
    maxLoginAttempts: 10, // More lenient
    lockoutDuration: 60, // 1 minute
    corsOrigins: ['*'] // Allow all origins in development
  },

  audit: {
    ...DEFAULT_AUTH_CONFIG.audit,
    logLevel: 'detailed', // More verbose logging for development
    retention: {
      type: 'time',
      value: 7 // 7 days only
    }
  }
}

/**
 * Testing configuration with minimal security
 * Should only be used in test environments
 */
export const TEST_AUTH_CONFIG: AuthConfig = {
  ...DEVELOPMENT_AUTH_CONFIG,

  jwt: {
    ...DEVELOPMENT_AUTH_CONFIG.jwt,
    accessTokenTTL: 60, // 1 minute for fast tests
    refreshTokenTTL: 300, // 5 minutes
    rotateRefreshTokens: false, // Simpler for testing
    ...generateKeyPair('HS256') // Generate HS256 secret for tests
  },

  password: {
    ...DEVELOPMENT_AUTH_CONFIG.password,
    minLength: 4, // Very short for testing
    saltRounds: 4 // Faster hashing for tests
  },

  session: {
    ...DEVELOPMENT_AUTH_CONFIG.session,
    ttl: 300, // 5 minutes
    cleanupInterval: 10, // 10 seconds
    cleanupBatchSize: 100
  },

  security: {
    ...DEVELOPMENT_AUTH_CONFIG.security,
    maxLoginAttempts: 100, // Effectively unlimited
    lockoutDuration: 1 // 1 second
  },

  audit: {
    ...DEVELOPMENT_AUTH_CONFIG.audit,
    enabled: false, // Disable audit logging in tests
    batchSize: 10,
    flushInterval: 1
  }
}

/**
 * High-security configuration for sensitive environments
 * Enhanced security settings for financial, healthcare, etc.
 */
export const HIGH_SECURITY_AUTH_CONFIG: AuthConfig = {
  ...DEFAULT_AUTH_CONFIG,

  jwt: {
    ...DEFAULT_AUTH_CONFIG.jwt,
    accessTokenTTL: 300, // 5 minutes
    refreshTokenTTL: 86400, // 1 day
    maxConcurrentSessions: 1 // Only one session per user
  },

  password: {
    ...DEFAULT_AUTH_CONFIG.password,
    minLength: 12, // Longer passwords
    maxAge: 30, // 30 days
    preventReuse: 10, // last 10 passwords
    saltRounds: 15 // More secure hashing
  },

  session: {
    ...DEFAULT_AUTH_CONFIG.session,
    ttl: 1800, // 30 minutes
    extendOnActivity: false, // No automatic extension
    maxConcurrentSessions: 1
  },

  security: {
    ...DEFAULT_AUTH_CONFIG.security,
    maxLoginAttempts: 3, // Very strict
    lockoutDuration: 1800, // 30 minutes
    corsOrigins: [] // No CORS allowed
  },

  audit: {
    ...DEFAULT_AUTH_CONFIG.audit,
    logLevel: 'detailed', // Full audit trail
    retention: {
      type: 'time',
      value: 2555 // 7 years (compliance requirement)
    },
    batchSize: 50, // Smaller batches for immediate logging
    flushInterval: 5 // 5 seconds
  }
}

/**
 * Get configuration based on environment
 */
export function getDefaultConfig(environment?: string): AuthConfig {
  switch (environment?.toLowerCase()) {
    case 'development':
    case 'dev':
      return DEVELOPMENT_AUTH_CONFIG

    case 'test':
    case 'testing':
      return TEST_AUTH_CONFIG

    case 'high-security':
    case 'financial':
    case 'healthcare':
      return HIGH_SECURITY_AUTH_CONFIG

    case 'production':
    case 'prod':
    default:
      return DEFAULT_AUTH_CONFIG
  }
}

/**
 * Validate configuration for security issues
 */
export function validateConfig(config: AuthConfig): ConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // JWT validation
  if (config.jwt.accessTokenTTL > 3600) {
    warnings.push('Access token TTL is longer than 1 hour, consider shorter duration for security')
  }

  if (config.jwt.algorithm === 'HS256' && !config.jwt.secret) {
    errors.push('HS256 algorithm requires a secret key')
  }

  if ((config.jwt.algorithm === 'ES256' || config.jwt.algorithm === 'RS256') &&
      (!config.jwt.privateKey || !config.jwt.publicKey)) {
    errors.push(`${config.jwt.algorithm} algorithm requires both private and public keys`)
  }

  // Password validation
  if (config.password.minLength < 8) {
    warnings.push('Password minimum length is less than 8 characters')
  }

  if (config.password.saltRounds < 10) {
    warnings.push('bcrypt salt rounds is less than 10, consider higher value for security')
  }

  // Security validation
  if (config.security.maxLoginAttempts > 10) {
    warnings.push('Max login attempts is high, consider lower value to prevent brute force')
  }

  if (config.security.lockoutDuration < 60) {
    warnings.push('Lockout duration is less than 1 minute, consider longer duration')
  }

  // Session validation
  if (config.session.maxConcurrentSessions > 10) {
    warnings.push('Max concurrent sessions is high, consider lower value')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Merge user configuration with defaults
 */
export function mergeConfig(userConfig: Partial<AuthConfig>, baseConfig?: AuthConfig): AuthConfig {
  const base = baseConfig || DEFAULT_AUTH_CONFIG

  return {
    jwt: { ...base.jwt, ...userConfig.jwt },
    password: { ...base.password, ...userConfig.password },
    session: { ...base.session, ...userConfig.session },
    security: { ...base.security, ...userConfig.security },
    audit: { ...base.audit, ...userConfig.audit },
    external: userConfig.external || base.external
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detect environment from NODE_ENV or other indicators
 */
export function detectEnvironment(): string {
  // Check NODE_ENV first
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV
  }

  // Check for test indicators
  if (process.env.JEST_WORKER_ID || process.env.VITEST || process.argv.includes('--test')) {
    return 'test'
  }

  // Check for development indicators
  if (process.env.DEBUG || process.argv.includes('--dev')) {
    return 'development'
  }

  // Default to production for safety
  return 'production'
}

/**
 * Get auto-detected configuration
 */
export function getAutoConfig(): AuthConfig {
  const environment = detectEnvironment()
  return getDefaultConfig(environment)
}