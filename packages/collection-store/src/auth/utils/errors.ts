// Error handling utilities for Collection Store Auth System
// Provides standardized error creation and handling

import { AuthError, AuthorizationError, TokenError, ValidationError } from '../interfaces/types'

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create authentication error
 */
export function createAuthError(
  message: string,
  code: string = 'AUTH_ERROR',
  statusCode: number = 401,
  details?: Record<string, any>
): AuthError {
  return new AuthError(message, code, statusCode, details)
}

/**
 * Create authorization error
 */
export function createAuthorizationError(
  message: string,
  details?: Record<string, any>
): AuthorizationError {
  return new AuthorizationError(message, details)
}

/**
 * Create token error
 */
export function createTokenError(
  message: string,
  details?: Record<string, any>
): TokenError {
  return new TokenError(message, details)
}

/**
 * Create validation error
 */
export function createValidationError(
  message: string,
  details?: Record<string, any>
): ValidationError {
  return new ValidationError(message, details)
}

// ============================================================================
// Specific Error Creators
// ============================================================================

/**
 * Create invalid credentials error
 */
export function createInvalidCredentialsError(): AuthError {
  return createAuthError(
    'Invalid email or password',
    'INVALID_CREDENTIALS',
    401,
    { reason: 'authentication_failed' }
  )
}

/**
 * Create account locked error
 */
export function createAccountLockedError(unlockTime?: Date): AuthError {
  return createAuthError(
    'Account is locked due to too many failed login attempts',
    'ACCOUNT_LOCKED',
    423,
    {
      reason: 'account_locked',
      unlockTime: unlockTime?.toISOString()
    }
  )
}

/**
 * Create account disabled error
 */
export function createAccountDisabledError(): AuthError {
  return createAuthError(
    'Account is disabled',
    'ACCOUNT_DISABLED',
    403,
    { reason: 'account_disabled' }
  )
}

/**
 * Create password expired error
 */
export function createPasswordExpiredError(): AuthError {
  return createAuthError(
    'Password has expired and must be changed',
    'PASSWORD_EXPIRED',
    403,
    {
      reason: 'password_expired',
      requiresPasswordChange: true
    }
  )
}

/**
 * Create invalid token error
 */
export function createInvalidTokenError(reason?: string): TokenError {
  return createTokenError(
    'Invalid or malformed token',
    {
      reason: reason || 'invalid_token',
      tokenValid: false
    }
  )
}

/**
 * Create expired token error
 */
export function createExpiredTokenError(): TokenError {
  return createTokenError(
    'Token has expired',
    {
      reason: 'token_expired',
      tokenValid: false,
      expired: true
    }
  )
}

/**
 * Create revoked token error
 */
export function createRevokedTokenError(): TokenError {
  return createTokenError(
    'Token has been revoked',
    {
      reason: 'token_revoked',
      tokenValid: false,
      revoked: true
    }
  )
}

/**
 * Create insufficient permissions error
 */
export function createInsufficientPermissionsError(
  resource: string,
  action: string
): AuthorizationError {
  return createAuthorizationError(
    `Insufficient permissions to ${action} ${resource}`,
    {
      reason: 'insufficient_permissions',
      resource,
      action,
      required: `${action}:${resource}`
    }
  )
}

/**
 * Create user not found error
 */
export function createUserNotFoundError(identifier: string): AuthError {
  return createAuthError(
    'User not found',
    'USER_NOT_FOUND',
    404,
    {
      reason: 'user_not_found',
      identifier
    }
  )
}

/**
 * Create email already exists error
 */
export function createEmailExistsError(email: string): ValidationError {
  return createValidationError(
    'Email address is already in use',
    {
      reason: 'email_exists',
      email,
      field: 'email'
    }
  )
}

/**
 * Create weak password error
 */
export function createWeakPasswordError(suggestions: string[]): ValidationError {
  return createValidationError(
    'Password does not meet security requirements',
    {
      reason: 'weak_password',
      field: 'password',
      suggestions
    }
  )
}

/**
 * Create rate limit exceeded error
 */
export function createRateLimitError(retryAfter?: number): AuthError {
  return createAuthError(
    'Too many requests. Please try again later.',
    'RATE_LIMIT_EXCEEDED',
    429,
    {
      reason: 'rate_limit_exceeded',
      retryAfter
    }
  )
}

/**
 * Create session limit exceeded error
 */
export function createSessionLimitError(maxSessions: number): AuthError {
  return createAuthError(
    `Maximum number of concurrent sessions (${maxSessions}) exceeded`,
    'SESSION_LIMIT_EXCEEDED',
    409,
    {
      reason: 'session_limit_exceeded',
      maxSessions
    }
  )
}

/**
 * Create configuration error
 */
export function createConfigurationError(message: string, details?: Record<string, any>): AuthError {
  return createAuthError(
    `Configuration error: ${message}`,
    'CONFIGURATION_ERROR',
    500,
    {
      reason: 'configuration_error',
      ...details
    }
  )
}

/**
 * Create database error
 */
export function createDatabaseError(operation: string, originalError?: Error): AuthError {
  return createAuthError(
    `Database operation failed: ${operation}`,
    'DATABASE_ERROR',
    500,
    {
      reason: 'database_error',
      operation,
      originalError: originalError?.message
    }
  )
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Check if error is an auth-related error
 */
export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Check if error is a token error
 */
export function isTokenError(error: any): error is TokenError {
  return error instanceof TokenError
}

/**
 * Check if error is an authorization error
 */
export function isAuthorizationError(error: any): error is AuthorizationError {
  return error instanceof AuthorizationError
}

/**
 * Extract error details for logging
 */
export function extractErrorDetails(error: any): ErrorDetails {
  if (isAuthError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }

  return {
    name: 'UnknownError',
    message: String(error)
  }
}

/**
 * Create safe error response (without sensitive information)
 */
export function createSafeErrorResponse(error: any): SafeErrorResponse {
  const details = extractErrorDetails(error)

  // Don't expose internal details in production
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    error: true,
    message: details.message,
    code: details.code || 'INTERNAL_ERROR',
    statusCode: details.statusCode || 500,
    ...(isProduction ? {} : { details: details.details }),
    timestamp: new Date().toISOString()
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorHandler?: (error: any) => AuthError
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      if (errorHandler) {
        throw errorHandler(error)
      }

      // If it's already an auth error, re-throw as is
      if (isAuthError(error)) {
        throw error
      }

      // Wrap unknown errors
      throw createAuthError(
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = () => true
  } = options

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if condition is not met
      if (!retryCondition(error)) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ErrorDetails {
  name: string
  message: string
  code?: string
  statusCode?: number
  details?: Record<string, any>
  stack?: string
}

export interface SafeErrorResponse {
  error: true
  message: string
  code: string
  statusCode: number
  details?: Record<string, any>
  timestamp: string
}

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: any) => boolean
}

// ============================================================================
// Error Code Constants
// ============================================================================

export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  PASSWORD_EXPIRED: 'PASSWORD_EXPIRED',

  // Token errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  REVOKED_TOKEN: 'REVOKED_TOKEN',

  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  EMAIL_EXISTS: 'EMAIL_EXISTS',

  // System errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SESSION_LIMIT_EXCEEDED: 'SESSION_LIMIT_EXCEEDED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]