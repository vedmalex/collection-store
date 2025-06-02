// Validation utilities for Collection Store Auth System
// Provides comprehensive input validation for security and data integrity

import { CreateUserData, UpdateUserData, PasswordConfig } from '../interfaces/types'
import { ValidationResult as IValidationResult, PasswordValidationResult, ValidationError } from '../interfaces/IUserManager'

// Simple validation result for internal use
interface SimpleValidationResult {
  valid: boolean
  errors: string[]
}

// Helper function to convert string errors to ValidationError objects
function createValidationError(message: string, field: string = 'general', code: string = 'VALIDATION_ERROR'): ValidationError {
  return { field, message, code }
}

// Helper function to convert string array to ValidationError array
function toValidationErrors(errors: string[], field: string = 'general'): ValidationError[] {
  return errors.map(error => createValidationError(error, field))
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validate email format using RFC 5322 compliant regex
 */
export function validateEmail(email: string): SimpleValidationResult {
  const errors: string[] = []

  if (!email) {
    errors.push('Email is required')
    return { valid: false, errors }
  }

  if (typeof email !== 'string') {
    errors.push('Email must be a string')
    return { valid: false, errors }
  }

  // Basic length check
  if (email.length > 254) {
    errors.push('Email is too long (max 254 characters)')
  }

  // RFC 5322 compliant regex (simplified but robust)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(email)) {
    errors.push('Invalid email format')
  }

  // Check for common issues
  if (email.includes('..')) {
    errors.push('Email cannot contain consecutive dots')
  }

  if (email.startsWith('.') || email.endsWith('.')) {
    errors.push('Email cannot start or end with a dot')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ============================================================================
// Password Validation
// ============================================================================

/**
 * Validate password strength based on configuration
 */
export function validatePassword(password: string, config: PasswordConfig): PasswordValidationResult {
  const errors: string[] = []
  const suggestions: string[] = []
  let score = 0

  if (!password) {
    return {
      valid: false,
      score: 0,
      errors: ['Password is required'],
      suggestions: ['Please provide a password']
    }
  }

  if (typeof password !== 'string') {
    return {
      valid: false,
      score: 0,
      errors: ['Password must be a string'],
      suggestions: []
    }
  }

  // Length validation
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`)
    suggestions.push(`Add ${config.minLength - password.length} more characters`)
  } else {
    score += Math.min(25, password.length * 2) // Up to 25 points for length
  }

  // Character type validation
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

  if (config.requireUppercase && !hasUppercase) {
    errors.push('Password must contain at least one uppercase letter')
    suggestions.push('Add an uppercase letter (A-Z)')
  } else if (hasUppercase) {
    score += 15
  }

  if (config.requireLowercase && !hasLowercase) {
    errors.push('Password must contain at least one lowercase letter')
    suggestions.push('Add a lowercase letter (a-z)')
  } else if (hasLowercase) {
    score += 15
  }

  if (config.requireNumbers && !hasNumbers) {
    errors.push('Password must contain at least one number')
    suggestions.push('Add a number (0-9)')
  } else if (hasNumbers) {
    score += 15
  }

  if (config.requireSpecialChars && !hasSpecialChars) {
    errors.push('Password must contain at least one special character')
    suggestions.push('Add a special character (!@#$%^&*)')
  } else if (hasSpecialChars) {
    score += 15
  }

  // Additional security checks
  if (password.length > 12) {
    score += 10 // Bonus for longer passwords
  }

  // Check for common patterns
  if (isCommonPassword(password)) {
    errors.push('Password is too common')
    suggestions.push('Use a more unique password')
    score = Math.max(0, score - 30)
  }

  if (hasRepeatingCharacters(password)) {
    suggestions.push('Avoid repeating characters')
    score = Math.max(0, score - 10)
  }

  if (hasSequentialCharacters(password)) {
    suggestions.push('Avoid sequential characters (abc, 123)')
    score = Math.max(0, score - 10)
  }

  // Ensure score is within bounds
  score = Math.min(100, Math.max(0, score))

  return {
    valid: errors.length === 0,
    score,
    errors,
    suggestions
  }
}

/**
 * Check if password is in common password list
 */
function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'shadow', 'superman', 'michael',
    'football', 'baseball', 'liverpool', 'jordan', 'princess'
  ]

  return commonPasswords.includes(password.toLowerCase())
}

/**
 * Check for repeating characters (aaa, 111)
 */
function hasRepeatingCharacters(password: string): boolean {
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      return true
    }
  }
  return false
}

/**
 * Check for sequential characters (abc, 123, xyz)
 */
function hasSequentialCharacters(password: string): boolean {
  for (let i = 0; i < password.length - 2; i++) {
    const char1 = password.charCodeAt(i)
    const char2 = password.charCodeAt(i + 1)
    const char3 = password.charCodeAt(i + 2)

    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return true
    }
  }
  return false
}

// ============================================================================
// User Data Validation
// ============================================================================

/**
 * Validate user creation data
 */
export function validateCreateUserData(userData: CreateUserData): IValidationResult {
  const errors: string[] = []

  // Email validation
  const emailValidation = validateEmail(userData.email)
  if (!emailValidation.valid) {
    errors.push(...emailValidation.errors)
  }

  // Required fields
  if (!userData.password) {
    errors.push('Password is required')
  }

  if (!userData.roles || !Array.isArray(userData.roles) || userData.roles.length === 0) {
    errors.push('At least one role is required')
  }

  // Optional field validation
  if (userData.firstName && typeof userData.firstName !== 'string') {
    errors.push('First name must be a string')
  }

  if (userData.lastName && typeof userData.lastName !== 'string') {
    errors.push('Last name must be a string')
  }

  if (userData.department && typeof userData.department !== 'string') {
    errors.push('Department must be a string')
  }

  // Attributes validation
  if (userData.attributes && typeof userData.attributes !== 'object') {
    errors.push('Attributes must be an object')
  }

  return {
    valid: errors.length === 0,
    errors: toValidationErrors(errors),
    warnings: []
  }
}

/**
 * Validate user update data
 */
export function validateUpdateUserData(userData: UpdateUserData): IValidationResult {
  const errors: string[] = []

  // Email validation (if provided)
  if (userData.email !== undefined) {
    const emailValidation = validateEmail(userData.email)
    if (!emailValidation.valid) {
      errors.push(...emailValidation.errors)
    }
  }

  // Roles validation (if provided)
  if (userData.roles !== undefined) {
    if (!Array.isArray(userData.roles)) {
      errors.push('Roles must be an array')
    } else if (userData.roles.length === 0) {
      errors.push('At least one role is required')
    }
  }

  // Optional field validation
  if (userData.firstName !== undefined && typeof userData.firstName !== 'string') {
    errors.push('First name must be a string')
  }

  if (userData.lastName !== undefined && typeof userData.lastName !== 'string') {
    errors.push('Last name must be a string')
  }

  if (userData.department !== undefined && typeof userData.department !== 'string') {
    errors.push('Department must be a string')
  }

  if (userData.isActive !== undefined && typeof userData.isActive !== 'boolean') {
    errors.push('isActive must be a boolean')
  }

  // Attributes validation
  if (userData.attributes !== undefined && typeof userData.attributes !== 'object') {
    errors.push('Attributes must be an object')
  }

  return {
    valid: errors.length === 0,
    errors: toValidationErrors(errors),
    warnings: []
  }
}

// ============================================================================
// General Validation Utilities
// ============================================================================

/**
 * Validate string field
 */
export function validateString(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
  } = {}
): SimpleValidationResult {
  const errors: string[] = []

  if (options.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`)
    return { valid: false, errors }
  }

  if (value !== undefined && value !== null && value !== '') {
    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`)
      return { valid: false, errors }
    }

    if (options.minLength && value.length < options.minLength) {
      errors.push(`${fieldName} must be at least ${options.minLength} characters long`)
    }

    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`${fieldName} must be no more than ${options.maxLength} characters long`)
    }

    if (options.pattern && !options.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate array field
 */
export function validateArray(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    minLength?: number
    maxLength?: number
    itemValidator?: (item: any) => SimpleValidationResult
  } = {}
): SimpleValidationResult {
  const errors: string[] = []

  if (options.required && (!value || !Array.isArray(value) || value.length === 0)) {
    errors.push(`${fieldName} is required and must be a non-empty array`)
    return { valid: false, errors }
  }

  if (value !== undefined && value !== null) {
    if (!Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`)
      return { valid: false, errors }
    }

    if (options.minLength && value.length < options.minLength) {
      errors.push(`${fieldName} must contain at least ${options.minLength} items`)
    }

    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`${fieldName} must contain no more than ${options.maxLength} items`)
    }

    // Validate individual items
    if (options.itemValidator) {
      value.forEach((item, index) => {
        const itemValidation = options.itemValidator!(item)
        if (!itemValidation.valid) {
          errors.push(`${fieldName}[${index}]: ${itemValidation.errors.join(', ')}`)
        }
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[<>]/g, '') // Remove potential HTML tags
}

/**
 * Validate and sanitize email
 */
export function validateAndSanitizeEmail(email: string): {
  valid: boolean
  email: string
  errors: string[]
} {
  const sanitized = sanitizeString(email).toLowerCase()
  const validation = validateEmail(sanitized)

  return {
    valid: validation.valid,
    email: sanitized,
    errors: validation.errors
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

// ValidationResult and PasswordValidationResult are imported from interfaces