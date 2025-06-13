// Common types and enums for Collection Store Auth System
// Integrates with existing CSDatabase and TypedCollection architecture

import { Item } from '../../types/Item'

// ============================================================================
// Core Auth Types
// ============================================================================

export interface User extends Item {
  id: string
  email: string
  passwordHash: string
  roles: string[]
  attributes: Record<string, any>
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  isActive: boolean

  // Optional profile fields
  firstName?: string
  lastName?: string
  department?: string

  // Security fields
  failedLoginAttempts?: number
  lockedUntil?: Date
  passwordChangedAt?: Date
  mustChangePassword?: boolean
}

export interface Role extends Item {
  id: string
  name: string
  description: string
  permissions: Permission[]
  parentRoles: string[] // hierarchy support
  isSystemRole: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface Permission {
  resource: string // database, collection, document, field
  action: string // read, write, delete, admin
  conditions?: string[] // dynamic conditions
  scope?: PermissionScope
}

export interface PermissionScope {
  type: 'global' | 'database' | 'collection' | 'document' | 'field'
  target?: string // specific database/collection/document/field
  filters?: Record<string, any> // additional filters
}

export interface Session extends Item {
  id: string
  userId: string
  createdAt: Date
  lastAccessAt: Date
  expiresAt: Date

  // Session data
  data: Record<string, any>

  // Security context
  ipAddress: string
  userAgent: string

  // Distributed session info
  nodeId?: string
  isActive: boolean
}

export interface AuditLog extends Item {
  id: string
  timestamp: Date
  userId?: string
  sessionId?: string
  action: string
  resource: string
  result: 'success' | 'failure' | 'denied'
  context: AuthContext
  details?: Record<string, any>

  // Performance tracking
  executionTime?: number

  // Request tracking
  requestId?: string
  correlationId?: string
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthCredentials {
  type: 'email_password' | 'oauth' | 'api_key' | 'external'
  email?: string
  password?: string
  oauthToken?: string
  apiKey?: string
  externalUserId?: string
  context?: AuthContext
}

export interface AuthContext {
  ip: string
  userAgent: string
  region?: string
  timestamp: number
  requestId?: string
  correlationId?: string
  customAttributes?: Record<string, any>
}

export interface AuthResult {
  success: boolean
  user?: User
  tokens?: TokenPair
  reason?: string
  requiresPasswordChange?: boolean
  requiresMFA?: boolean

  // Rate limiting info
  attemptsRemaining?: number
  lockoutUntil?: Date
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  tokenType: 'Bearer'
}

export interface TokenValidation {
  valid: boolean
  expired: boolean
  user?: User
  session?: Session
  reason?: string

  // Token metadata
  issuedAt?: Date
  expiresAt?: Date
  issuer?: string
  audience?: string
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AuthConfig {
  // JWT Configuration
  jwt: JWTConfig

  // Password Policy
  password: PasswordConfig

  // Session Management
  session: SessionConfig

  // Security Settings
  security: SecurityConfig

  // Audit Configuration
  audit: AuditConfig

  // External Auth
  external?: ExternalAuthConfig
}

export interface JWTConfig {
  algorithm: 'ES256' | 'RS256' | 'HS256'
  accessTokenTTL: number // seconds
  refreshTokenTTL: number // seconds
  rotateRefreshTokens: boolean

  // Key management
  publicKey?: string
  privateKey?: string
  secret?: string // for HS256

  // Token settings
  issuer: string
  audience: string

  // Security
  enableRevocation: boolean
  maxConcurrentSessions: number
  requireSecureContext: boolean
}

export interface PasswordConfig {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean

  // Security
  maxAge: number // days
  preventReuse: number // number of previous passwords

  // Hashing
  saltRounds: number
}

export interface SessionConfig {
  ttl: number // seconds
  extendOnActivity: boolean
  maxConcurrentSessions: number

  // Cleanup
  cleanupInterval: number // seconds
  cleanupBatchSize: number
}

export interface SecurityConfig {
  // Rate limiting
  maxLoginAttempts: number
  lockoutDuration: number // seconds

  // IP restrictions
  allowedIPs?: string[]
  blockedIPs?: string[]

  // Time restrictions
  allowedTimeRanges?: TimeRange[]

  // CORS
  corsOrigins?: string[]
}

export interface TimeRange {
  start: string // HH:MM format
  end: string // HH:MM format
  timezone?: string
  daysOfWeek?: number[] // 0-6, Sunday = 0
}

export interface AuditConfig {
  enabled: boolean
  retention: {
    type: 'time' | 'count'
    value: number // days or count
  }
  logLevel: 'minimal' | 'standard' | 'detailed'

  // Performance
  batchSize: number
  flushInterval: number // seconds

  // Storage
  useWAL: boolean // integrate with existing WAL system
  compression: boolean
}

export interface ExternalAuthConfig {
  providers: ExternalAuthProvider[]
  defaultProvider?: string
  fallbackToLocal: boolean
}

export interface ExternalAuthProvider {
  id: string
  name: string
  type: 'oauth2' | 'saml' | 'ldap' | 'custom'
  config: Record<string, any>
  enabled: boolean

  // User mapping
  userMapping: {
    email: string
    firstName?: string
    lastName?: string
    roles?: string[]
    attributes?: Record<string, string>
  }
}

// ============================================================================
// Authorization Types
// ============================================================================

export interface ResourceDescriptor {
  type: 'database' | 'collection' | 'document' | 'field'
  database?: string
  collection?: string
  documentId?: string
  fieldPath?: string

  // Additional context
  metadata?: Record<string, any>
}

export interface AuthorizationResult {
  allowed: boolean
  reason: string
  appliedRules: string[]
  cacheHit: boolean

  // Performance metrics
  evaluationTime: number
  rulesEvaluated: number
}

export interface DynamicRule {
  id: string
  name: string
  priority: number
  type: 'allow' | 'deny'

  // Rule evaluation function
  evaluator: (user: User, resource: any, context: AuthContext) => Promise<boolean>

  // Metadata
  description: string
  createdBy: string
  createdAt: Date
  isActive: boolean

  // Performance
  timeout?: number // milliseconds
  cacheResult?: boolean
  cacheTTL?: number // seconds
}

// ============================================================================
// Error Types
// ============================================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class AuthorizationError extends AuthError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_FAILED', 403, details)
    this.name = 'AuthorizationError'
  }
}

export class TokenError extends AuthError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'TOKEN_ERROR', 401, details)
    this.name = 'TokenError'
  }
}

export class ValidationError extends AuthError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type CreateUserData = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'passwordHash'> & {
  password: string
}

export type UpdateUserData = Partial<Omit<User, 'id' | 'createdAt' | 'passwordHash'>>

export type CreateRoleData = Omit<Role, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateRoleData = Partial<Omit<Role, 'id' | 'createdAt'>>

// ============================================================================
// Collection Schema Types for TypedCollection integration
// ============================================================================

export interface UserSchema {
  id: { type: 'string'; required: true; unique: true }
  email: { type: 'string'; required: true; unique: true }
  passwordHash: { type: 'string'; required: true }
  roles: { type: 'array'; items: { type: 'string' }; default: [] }
  attributes: { type: 'object'; default: {} }
  createdAt: { type: 'date'; required: true; default: 'now' }
  updatedAt: { type: 'date'; required: true; default: 'now' }
  lastLoginAt: { type: 'date'; required: false }
  isActive: { type: 'boolean'; required: true; default: true }
  firstName: { type: 'string'; required: false }
  lastName: { type: 'string'; required: false }
  department: { type: 'string'; required: false }
  failedLoginAttempts: { type: 'number'; default: 0 }
  lockedUntil: { type: 'date'; required: false }
  passwordChangedAt: { type: 'date'; required: false }
  mustChangePassword: { type: 'boolean'; default: false }
}

export interface RoleSchema {
  id: { type: 'string'; required: true; unique: true }
  name: { type: 'string'; required: true; unique: true }
  description: { type: 'string'; required: true }
  permissions: { type: 'array'; items: { type: 'object' }; default: [] }
  parentRoles: { type: 'array'; items: { type: 'string' }; default: [] }
  isSystemRole: { type: 'boolean'; required: true; default: false }
  createdAt: { type: 'date'; required: true; default: 'now' }
  updatedAt: { type: 'date'; required: true; default: 'now' }
  createdBy: { type: 'string'; required: true }
}

export interface SessionSchema {
  id: { type: 'string'; required: true; unique: true }
  userId: { type: 'string'; required: true; index: true }
  createdAt: { type: 'date'; required: true; default: 'now' }
  lastAccessAt: { type: 'date'; required: true; default: 'now' }
  expiresAt: { type: 'date'; required: true; index: true }
  data: { type: 'object'; default: {} }
  ipAddress: { type: 'string'; required: true }
  userAgent: { type: 'string'; required: true }
  nodeId: { type: 'string'; required: false }
  isActive: { type: 'boolean'; required: true; default: true }
}

export interface AuditLogSchema {
  id: { type: 'string'; required: true; unique: true }
  timestamp: { type: 'date'; required: true; default: 'now'; index: true }
  userId: { type: 'string'; required: false; index: true }
  sessionId: { type: 'string'; required: false; index: true }
  action: { type: 'string'; required: true; index: true }
  resource: { type: 'string'; required: true; index: true }
  result: { type: 'string'; required: true; enum: ['success', 'failure', 'denied'] }
  context: { type: 'object'; required: true }
  details: { type: 'object'; required: false }
  executionTime: { type: 'number'; required: false }
  requestId: { type: 'string'; required: false; index: true }
  correlationId: { type: 'string'; required: false; index: true }
}