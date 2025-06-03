/**
 * Enhanced error handling types for computed attributes system
 * Provides comprehensive error tracking, categorization, and recovery
 */

/**
 * Enhanced computed attribute error with detailed context
 */
export interface ComputedAttributeErrorDetailed extends Error {
  name: 'ComputedAttributeError'
  code: ComputedAttributeErrorCodeDetailed
  category: ErrorCategory
  severity: ErrorSeverity

  // Context information
  attributeId?: string
  targetId?: string
  targetType?: 'user' | 'document' | 'collection' | 'database'

  // Error details
  originalError?: Error
  stackTrace?: string
  context?: ErrorContext

  // Timing information
  timestamp: Date
  computeTime?: number
  retryCount?: number

  // Recovery information
  recoverable: boolean
  suggestedAction?: string
  retryAfter?: number // milliseconds

  // Metadata
  nodeId?: string
  userId?: string
  sessionId?: string
}

/**
 * Error categories for better organization
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  COMPUTATION = 'computation',
  CACHE = 'cache',
  DEPENDENCY = 'dependency',
  SECURITY = 'security',
  EXTERNAL = 'external',
  SYSTEM = 'system',
  CONFIGURATION = 'configuration'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Enhanced error codes with more specific categorization
 */
export enum ComputedAttributeErrorCodeDetailed {
  // Validation errors
  ATTRIBUTE_NOT_FOUND = 'ATTRIBUTE_NOT_FOUND',
  ATTRIBUTE_ALREADY_EXISTS = 'ATTRIBUTE_ALREADY_EXISTS',
  INVALID_DEFINITION = 'INVALID_DEFINITION',
  INVALID_TARGET_TYPE = 'INVALID_TARGET_TYPE',
  INVALID_COMPUTE_FUNCTION = 'INVALID_COMPUTE_FUNCTION',

  // Computation errors
  COMPUTATION_FAILED = 'COMPUTATION_FAILED',
  COMPUTATION_TIMEOUT = 'COMPUTATION_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  STACK_OVERFLOW = 'STACK_OVERFLOW',
  INVALID_RETURN_VALUE = 'INVALID_RETURN_VALUE',

  // Dependency errors
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  DEPENDENCY_NOT_FOUND = 'DEPENDENCY_NOT_FOUND',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  DEPENDENCY_TIMEOUT = 'DEPENDENCY_TIMEOUT',
  INVALID_DEPENDENCY = 'INVALID_DEPENDENCY',
  MAX_DEPENDENCIES_EXCEEDED = 'MAX_DEPENDENCIES_EXCEEDED',
  DEPENDENCY_TRACKER_NOT_INITIALIZED = 'DEPENDENCY_TRACKER_NOT_INITIALIZED',
  DEPENDENCY_TRACKER_ALREADY_INITIALIZED = 'DEPENDENCY_TRACKER_ALREADY_INITIALIZED',

  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_MISS = 'CACHE_MISS',
  CACHE_CORRUPTION = 'CACHE_CORRUPTION',
  CACHE_EVICTION_FAILED = 'CACHE_EVICTION_FAILED',
  CACHE_SIZE_EXCEEDED = 'CACHE_SIZE_EXCEEDED',

  // External service errors
  EXTERNAL_REQUEST_FAILED = 'EXTERNAL_REQUEST_FAILED',
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE',
  EXTERNAL_RATE_LIMIT = 'EXTERNAL_RATE_LIMIT',
  EXTERNAL_AUTHENTICATION_FAILED = 'EXTERNAL_AUTHENTICATION_FAILED',
  EXTERNAL_TIMEOUT = 'EXTERNAL_TIMEOUT',

  // Security errors
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SANDBOX_VIOLATION = 'SANDBOX_VIOLATION',
  MALICIOUS_CODE_DETECTED = 'MALICIOUS_CODE_DETECTED',

  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE',
  SYSTEM_OVERLOAD = 'SYSTEM_OVERLOAD',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

/**
 * Error context providing additional debugging information
 */
export interface ErrorContext {
  // Computation context
  computationStep?: string
  inputData?: any
  intermediateResults?: any

  // System context
  memoryUsage?: number
  cpuUsage?: number
  activeComputations?: number

  // Request context
  requestId?: string
  userAgent?: string
  ipAddress?: string

  // Custom context
  customData?: Record<string, any>
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'skip' | 'abort'
  maxRetries?: number
  retryDelay?: number // milliseconds
  backoffMultiplier?: number
  fallbackValue?: any
  fallbackAttributeId?: string
  condition?: (error: ComputedAttributeErrorDetailed) => boolean
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  // Global settings
  enableDetailedErrors: boolean
  logErrors: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'

  // Retry settings
  defaultRetryCount: number
  defaultRetryDelay: number
  maxRetryDelay: number

  // Recovery settings
  enableAutoRecovery: boolean
  recoveryStrategies: Map<ComputedAttributeErrorCodeDetailed, ErrorRecoveryStrategy>

  // Monitoring
  enableErrorMetrics: boolean
  errorMetricsRetention: number // seconds
  alertThresholds: {
    errorRate: number // errors per minute
    criticalErrors: number // critical errors per hour
    timeoutRate: number // timeout rate percentage
  }
}

/**
 * Error statistics and monitoring
 */
export interface ErrorStatistics {
  // Overall statistics
  totalErrors: number
  errorRate: number // errors per minute
  averageErrorRate: number

  // Error breakdown
  errorsByCode: Map<ComputedAttributeErrorCodeDetailed, number>
  errorsByCategory: Map<ErrorCategory, number>
  errorsBySeverity: Map<ErrorSeverity, number>

  // Timing statistics
  averageErrorTime: number
  timeoutCount: number
  timeoutRate: number

  // Recovery statistics
  recoveredErrors: number
  recoveryRate: number
  failedRecoveries: number

  // Trends
  errorTrend: 'increasing' | 'decreasing' | 'stable'
  mostCommonErrors: Array<{
    code: ComputedAttributeErrorCodeDetailed
    count: number
    lastOccurrence: Date
  }>

  // Health metrics
  systemHealth: number // 0-100
  lastHealthCheck: Date
}

/**
 * Error event for monitoring and alerting
 */
export interface ErrorEvent {
  error: ComputedAttributeErrorDetailed
  timestamp: Date
  resolved: boolean
  resolutionTime?: number
  resolutionMethod?: 'retry' | 'fallback' | 'manual' | 'timeout'

  // Impact assessment
  affectedUsers?: number
  affectedAttributes?: string[]
  businessImpact?: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  /**
   * Handle an error with appropriate recovery strategy
   */
  handleError(error: ComputedAttributeErrorDetailed): Promise<ErrorHandlingResult>

  /**
   * Register a custom error recovery strategy
   */
  registerRecoveryStrategy(
    errorCode: ComputedAttributeErrorCodeDetailed,
    strategy: ErrorRecoveryStrategy
  ): void

  /**
   * Get error statistics
   */
  getErrorStatistics(): Promise<ErrorStatistics>

  /**
   * Subscribe to error events
   */
  onError(handler: (event: ErrorEvent) => void): void
}

/**
 * Result of error handling
 */
export interface ErrorHandlingResult {
  handled: boolean
  recovered: boolean
  strategy: ErrorRecoveryStrategy['type']
  retryCount: number
  fallbackUsed: boolean
  fallbackValue?: any
  executionTime: number
  finalError?: ComputedAttributeErrorDetailed
}

/**
 * Error factory for creating standardized errors
 */
export class ComputedAttributeErrorFactory {
  static create(
    message: string,
    code: ComputedAttributeErrorCodeDetailed,
    category?: ErrorCategory | string,
    options?: {
      attributeId?: string
      targetId?: string
      targetType?: 'user' | 'document' | 'collection' | 'database'
      originalError?: Error
      context?: ErrorContext
      recoverable?: boolean
      suggestedAction?: string
    }
  ): ComputedAttributeErrorDetailed {
    const error = new Error(message) as ComputedAttributeErrorDetailed
    error.name = 'ComputedAttributeError'
    error.code = code
    error.category = (category as ErrorCategory) || this.getErrorCategory(code)
    error.severity = this.getErrorSeverity(code)
    error.timestamp = new Date()
    error.recoverable = options?.recoverable ?? this.isRecoverable(code)

    if (options) {
      Object.assign(error, options)
    }

    return error
  }

  private static getErrorCategory(code: ComputedAttributeErrorCodeDetailed): ErrorCategory {
    if (code.includes('VALIDATION') || code.includes('INVALID')) {
      return ErrorCategory.VALIDATION
    }
    if (code.includes('COMPUTATION') || code.includes('MEMORY') || code.includes('TIMEOUT')) {
      return ErrorCategory.COMPUTATION
    }
    if (code.includes('CACHE')) {
      return ErrorCategory.CACHE
    }
    if (code.includes('DEPENDENCY')) {
      return ErrorCategory.DEPENDENCY
    }
    if (code.includes('SECURITY') || code.includes('UNAUTHORIZED') || code.includes('SANDBOX')) {
      return ErrorCategory.SECURITY
    }
    if (code.includes('EXTERNAL')) {
      return ErrorCategory.EXTERNAL
    }
    if (code.includes('DATABASE') || code.includes('NETWORK') || code.includes('SYSTEM')) {
      return ErrorCategory.SYSTEM
    }
    return ErrorCategory.CONFIGURATION
  }

  private static getErrorSeverity(code: ComputedAttributeErrorCodeDetailed): ErrorSeverity {
    const criticalErrors = [
      ComputedAttributeErrorCodeDetailed.SYSTEM_OVERLOAD,
      ComputedAttributeErrorCodeDetailed.DATABASE_ERROR,
      ComputedAttributeErrorCodeDetailed.MALICIOUS_CODE_DETECTED,
      ComputedAttributeErrorCodeDetailed.SECURITY_VIOLATION
    ]

    const highErrors = [
      ComputedAttributeErrorCodeDetailed.CIRCULAR_DEPENDENCY,
      ComputedAttributeErrorCodeDetailed.MEMORY_LIMIT_EXCEEDED,
      ComputedAttributeErrorCodeDetailed.STACK_OVERFLOW,
      ComputedAttributeErrorCodeDetailed.CACHE_CORRUPTION
    ]

    if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL
    if (highErrors.includes(code)) return ErrorSeverity.HIGH
    if (code.includes('TIMEOUT') || code.includes('FAILED')) return ErrorSeverity.MEDIUM
    return ErrorSeverity.LOW
  }

  private static isRecoverable(code: ComputedAttributeErrorCodeDetailed): boolean {
    const nonRecoverableErrors = [
      ComputedAttributeErrorCodeDetailed.CIRCULAR_DEPENDENCY,
      ComputedAttributeErrorCodeDetailed.INVALID_DEFINITION,
      ComputedAttributeErrorCodeDetailed.MALICIOUS_CODE_DETECTED,
      ComputedAttributeErrorCodeDetailed.SECURITY_VIOLATION
    ]

    return !nonRecoverableErrors.includes(code)
  }
}