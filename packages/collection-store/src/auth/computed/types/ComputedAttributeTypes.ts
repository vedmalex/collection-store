import type { CSDatabase } from '../../..'
import type { User } from '../../interfaces'

/**
 * Core computed attribute definition
 */
export interface ComputedAttributeDefinition {
  id: string
  name: string
  description: string

  // Target specification
  targetType: 'user' | 'document' | 'collection' | 'database'
  targetCollection?: string // для document-level атрибутов

  // Computation logic
  computeFunction: ComputeFunction
  dependencies: AttributeDependency[]

  // Caching strategy
  caching: {
    enabled: boolean
    ttl: number // seconds
    invalidateOn: InvalidationTrigger[]
  }

  // Security
  security: {
    allowExternalRequests: boolean
    timeout: number // milliseconds
    maxMemoryUsage: number // bytes
  }

  // Metadata
  createdBy: string
  createdAt: Date
  isActive: boolean
}

/**
 * Function that computes the attribute value
 */
export type ComputeFunction = (context: ComputationContext) => Promise<any>

/**
 * Context provided to compute functions
 */
export interface ComputationContext {
  // Target data
  target: any // current user/document/collection
  targetId: string
  targetType: 'user' | 'document' | 'collection' | 'database'

  // Database access
  database: CSDatabase
  currentCollection?: any // Collection<any>

  // External services
  httpClient?: HttpClient

  // System context
  timestamp: number
  nodeId: string

  // User context (for authorization)
  currentUser?: User
  authContext?: AuthContext

  // Custom context
  customData?: Record<string, any>
}

/**
 * HTTP client for external API calls
 */
export interface HttpClient {
  get(url: string, options?: RequestOptions): Promise<HttpResponse>
  post(url: string, data?: any, options?: RequestOptions): Promise<HttpResponse>
  put(url: string, data?: any, options?: RequestOptions): Promise<HttpResponse>
  delete(url: string, options?: RequestOptions): Promise<HttpResponse>
}

/**
 * HTTP request options
 */
export interface RequestOptions {
  timeout?: number
  headers?: Record<string, string>
  params?: Record<string, any>
}

/**
 * HTTP response
 */
export interface HttpResponse {
  status: number
  statusText: string
  data: any
  headers: Record<string, string>
}

/**
 * Authentication context
 */
export interface AuthContext {
  ip: string
  userAgent: string
  region?: string
  timestamp: number
  customAttributes?: Record<string, any>
}

/**
 * Dependency specification for computed attributes
 */
export interface AttributeDependency {
  type: 'field' | 'collection' | 'external_api' | 'system'
  source: string // field path, collection name, API endpoint, etc.
  invalidateOnChange: boolean
}

/**
 * Trigger for cache invalidation
 */
export interface InvalidationTrigger {
  type: 'field_change' | 'document_change' | 'collection_change' | 'time_based' | 'external_event'
  source: string
  condition?: string // optional condition for invalidation
}

/**
 * Error information for computed attributes system
 */
export interface ComputedAttributeError {
  name: 'ComputedAttributeError'
  message: string
  code: string
  attributeId?: string
  cause?: Error
}

/**
 * Error codes for computed attributes
 */
export enum ComputedAttributeErrorCode {
  ATTRIBUTE_NOT_FOUND = 'ATTRIBUTE_NOT_FOUND',
  ATTRIBUTE_ALREADY_EXISTS = 'ATTRIBUTE_ALREADY_EXISTS',
  INVALID_DEFINITION = 'INVALID_DEFINITION',
  COMPUTATION_FAILED = 'COMPUTATION_FAILED',
  COMPUTATION_TIMEOUT = 'COMPUTATION_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  EXTERNAL_REQUEST_FAILED = 'EXTERNAL_REQUEST_FAILED',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  CACHE_ERROR = 'CACHE_ERROR',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION'
}

/**
 * Result of attribute computation
 */
export interface ComputationResult {
  attributeId: string
  targetId: string
  value: any
  computedAt: Date
  computeTime: number // milliseconds
  cached: boolean
  dependencies: string[]
}

/**
 * Batch computation request
 */
export interface BatchComputationRequest {
  attributeIds: string[]
  context: ComputationContext
  options?: {
    parallel?: boolean
    failFast?: boolean
    timeout?: number
  }
}

/**
 * Batch computation result
 */
export interface BatchComputationResult {
  results: Record<string, ComputationResult>
  errors: Record<string, ComputedAttributeError>
  totalTime: number
  successCount: number
  errorCount: number
}