// Cryptographic utilities for Collection Store Auth System
// Provides secure password hashing, key generation, and JWT operations

import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import { randomBytes, createHash, generateKeyPairSync } from 'crypto'
import { JWTConfig } from '../interfaces/types'
import { TokenClaims, TokenHeader } from '../interfaces/ITokenManager'

// ============================================================================
// Password Hashing
// ============================================================================

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string, saltRounds: number = 12): Promise<string> {
  try {
    return await bcrypt.hash(password, saltRounds)
  } catch (error) {
    throw new Error(`Failed to hash password: ${error.message}`)
  }
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    throw new Error(`Failed to verify password: ${error.message}`)
  }
}

/**
 * Check if password hash needs rehashing (due to changed salt rounds)
 */
export function needsRehash(hash: string, saltRounds: number): boolean {
  try {
    const rounds = bcrypt.getRounds(hash)
    return rounds !== saltRounds
  } catch (error) {
    return true // If we can't determine rounds, assume rehash needed
  }
}

// ============================================================================
// Random Generation
// ============================================================================

/**
 * Generate cryptographically secure random string
 */
export function generateRandomString(length: number = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * Generate random ID for tokens, sessions, etc.
 */
export function generateId(): string {
  return generateRandomString(16)
}

/**
 * Generate API key
 */
export function generateApiKey(prefix: string = 'cs'): string {
  const timestamp = Date.now().toString(36)
  const random = generateRandomString(24)
  return `${prefix}_${timestamp}_${random}`
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate ES256 key pair
 */
export function generateES256KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    }
  })

  return { privateKey, publicKey }
}

/**
 * Generate RS256 key pair
 */
export function generateRS256KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    }
  })

  return { privateKey, publicKey }
}

/**
 * Generate HS256 secret
 */
export function generateHS256Secret(): string {
  return generateRandomString(64) // 512 bits
}

/**
 * Generate key pair based on algorithm
 */
export function generateKeyPair(algorithm: 'ES256' | 'RS256' | 'HS256'): {
  privateKey?: string
  publicKey?: string
  secret?: string
} {
  switch (algorithm) {
    case 'ES256':
      return generateES256KeyPair()
    case 'RS256':
      return generateRS256KeyPair()
    case 'HS256':
      return { secret: generateHS256Secret() }
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`)
  }
}

// ============================================================================
// JWT Operations
// ============================================================================

/**
 * Sign JWT token
 */
export function signJWT(
  payload: object,
  config: JWTConfig,
  options?: jwt.SignOptions
): string {
  const key = getSigningKey(config)
  const signOptions: jwt.SignOptions = {
    algorithm: config.algorithm,
    issuer: config.issuer,
    audience: config.audience,
    ...options
  }

  return jwt.sign(payload, key, signOptions)
}

/**
 * Verify JWT token
 */
export function verifyJWT(
  token: string,
  config: JWTConfig,
  options?: jwt.VerifyOptions
): TokenClaims {
  const key = getVerificationKey(config)
  const verifyOptions: jwt.VerifyOptions = {
    algorithms: [config.algorithm],
    issuer: config.issuer,
    audience: config.audience,
    ...options
  }

  return jwt.verify(token, key, verifyOptions) as TokenClaims
}

/**
 * Decode JWT token without verification
 */
export function decodeJWT(token: string): {
  header: TokenHeader
  payload: TokenClaims
  signature: string
} | null {
  try {
    const decoded = jwt.decode(token, { complete: true })
    return decoded as any
  } catch (error) {
    return null
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeJWT(token)
  if (!decoded?.payload?.exp) {
    return null
  }
  return new Date(decoded.payload.exp * 1000)
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpiration(token)
  if (!expiration) {
    return true // If no expiration, consider expired
  }
  return expiration <= new Date()
}

/**
 * Get signing key based on algorithm
 */
function getSigningKey(config: JWTConfig): string {
  switch (config.algorithm) {
    case 'HS256':
      if (!config.secret) {
        throw new Error('HS256 requires secret key')
      }
      return config.secret

    case 'ES256':
    case 'RS256':
      if (!config.privateKey) {
        throw new Error(`${config.algorithm} requires private key`)
      }
      return config.privateKey

    default:
      throw new Error(`Unsupported algorithm: ${config.algorithm}`)
  }
}

/**
 * Get verification key based on algorithm
 */
function getVerificationKey(config: JWTConfig): string {
  switch (config.algorithm) {
    case 'HS256':
      if (!config.secret) {
        throw new Error('HS256 requires secret key')
      }
      return config.secret

    case 'ES256':
    case 'RS256':
      if (!config.publicKey) {
        throw new Error(`${config.algorithm} requires public key`)
      }
      return config.publicKey

    default:
      throw new Error(`Unsupported algorithm: ${config.algorithm}`)
  }
}

// ============================================================================
// Hashing Utilities
// ============================================================================

/**
 * Create SHA-256 hash
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Create SHA-512 hash
 */
export function sha512(data: string): string {
  return createHash('sha512').update(data).digest('hex')
}

/**
 * Create HMAC signature
 */
export function hmac(data: string, key: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm).update(data + key).digest('hex')
}

// ============================================================================
// Timing Safe Comparison
// ============================================================================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================================================
// Key Validation
// ============================================================================

/**
 * Validate JWT configuration keys
 */
export function validateJWTKeys(config: JWTConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  switch (config.algorithm) {
    case 'HS256':
      if (!config.secret) {
        errors.push('HS256 requires secret key')
      } else if (config.secret.length < 32) {
        errors.push('HS256 secret should be at least 32 characters')
      }
      break

    case 'ES256':
      if (!config.privateKey || !config.publicKey) {
        errors.push('ES256 requires both private and public keys')
      } else {
        try {
          // Test key validity by attempting to sign and verify
          const testPayload = { test: true }
          const token = signJWT(testPayload, config, { expiresIn: '1s' })
          verifyJWT(token, config)
        } catch (error) {
          errors.push(`ES256 key validation failed: ${error.message}`)
        }
      }
      break

    case 'RS256':
      if (!config.privateKey || !config.publicKey) {
        errors.push('RS256 requires both private and public keys')
      } else {
        try {
          // Test key validity by attempting to sign and verify
          const testPayload = { test: true }
          const token = signJWT(testPayload, config, { expiresIn: '1s' })
          verifyJWT(token, config)
        } catch (error) {
          errors.push(`RS256 key validation failed: ${error.message}`)
        }
      }
      break

    default:
      errors.push(`Unsupported algorithm: ${config.algorithm}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}