// Core types for Stored Functions & Procedures System
import type { CSDatabase } from '../../../CSDatabase'
import type { User } from '../../interfaces/types'

// ============================================================================
// Core Function Types
// ============================================================================

export interface StoredFunctionDefinition {
  id: string
  name: string
  description: string
  type: 'computed_view' | 'stored_procedure' | 'scalar_function'

  // TypeScript implementation
  implementation: TypeScriptFunctionImplementation
  typeDefinitions?: string

  // Parameters with TypeScript types
  parameters: TypedFunctionParameter[]
  returnType: TypedFunctionReturnType

  // Security
  security: FunctionSecurity

  // Transaction management
  transaction: TransactionConfig

  // Caching (for computed views)
  caching?: CachingConfig

  // Dependencies
  dependencies: FunctionDependency[]

  // Versioning & Deployment
  version: string
  previousVersions: FunctionVersion[]
  deploymentStrategy: DeploymentStrategy
  abTestConfig?: ABTestConfig

  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface TypeScriptFunctionImplementation {
  code: string // TypeScript/JavaScript code
  compiledCode?: string // compiled JavaScript
  sourceMap?: string
  dependencies?: string[] // npm packages if needed
}

export interface TypedFunctionParameter {
  name: string
  type: string // TypeScript type string
  required: boolean
  defaultValue?: any
  validation?: ParameterValidation
  description?: string
}

export interface TypedFunctionReturnType {
  type: 'scalar' | 'dataset' | 'stream' | 'void'
  typeDefinition: string // TypeScript type
  schema?: any // JSON schema для dataset
  streamChunkSize?: number // для stream
}

export interface ParameterValidation {
  min?: number
  max?: number
  pattern?: string
  enum?: any[]
  custom?: (value: any) => boolean | string
}

// ============================================================================
// Security & Execution Context
// ============================================================================

export interface FunctionSecurity {
  executionMode: 'caller_rights' // только caller_rights по требованию
  allowedRoles: string[]
  maxExecutionTime: number // configurable, no default limit
  maxMemoryUsage: number // configurable
  maxDbOperations: number // configurable
  sandboxed: true // всегда в sandbox
}

export interface FunctionExecutionContext {
  // User context
  currentUser: {
    id: string
    email: string
    roles: string[]
    permissions: string[]
    attributes: Record<string, any>
  }

  // Database access
  database: CSDatabase

  // Request context
  requestId: string
  timestamp: Date
  clientInfo?: {
    ip: string
    userAgent: string
  }

  // Execution limits
  limits: ResourceLimits
}

export interface ResourceLimits {
  maxExecutionTime: number // milliseconds
  maxMemoryUsage: number // bytes
  maxDbOperations: number
  maxNetworkRequests: number
  allowedModules: string[]
}

// ============================================================================
// Transaction & Caching
// ============================================================================

export interface TransactionConfig {
  autoTransaction: boolean // true по умолчанию
  isolationLevel?: 'read_committed' | 'repeatable_read' | 'serializable'
  timeout?: number
}

export interface CachingConfig {
  enabled: boolean
  strategy: 'dependency_based' // только по зависимостям
  ttl: number // seconds
  invalidateOn: ViewInvalidationTrigger[]
  subscriptionBased?: boolean // для будущего развития
}

export interface ViewInvalidationTrigger {
  type: 'field_change' | 'document_change' | 'collection_change' | 'time_based' | 'external_event'
  source: string
  condition?: string // optional condition for invalidation
}

export interface FunctionDependency {
  type: 'collection' | 'external_api' | 'system' | 'function'
  source: string // collection name, API endpoint, function ID, etc.
  access: 'read' | 'write' | 'admin'
  invalidateOnChange?: boolean
}

// ============================================================================
// Deployment & Versioning
// ============================================================================

export interface DeploymentStrategy {
  type: 'immediate' | 'blue_green' | 'canary' | 'ab_test'
  rolloutPercentage?: number // для canary
  healthCheckEndpoint?: string
  autoRollbackOnError: boolean // true по умолчанию
  maxErrorRate?: number // для auto rollback
}

export interface ABTestConfig {
  enabled: boolean
  versions: {
    version: string
    trafficPercentage: number
  }[]
  metrics: string[] // метрики для сравнения
  duration: number // длительность теста в секундах
}

export interface FunctionVersion {
  version: string
  code: string
  deployedAt: Date
  isActive: boolean
  performanceMetrics?: PerformanceMetrics
}

// ============================================================================
// Results & Monitoring
// ============================================================================

export interface FunctionResult {
  data: any
  metadata: {
    functionId: string
    version: string
    executionTime: number
    fromCache: boolean
    cacheHit?: boolean
  }
}

export interface ComputedViewResult extends FunctionResult {
  metadata: FunctionResult['metadata'] & {
    cacheKey?: string
    dependenciesChecked: string[]
  }
}

export interface ProcedureResult extends FunctionResult {
  metadata: FunctionResult['metadata'] & {
    transactionId?: string
    dbOperationsCount: number
  }
}

export interface PerformanceMetrics {
  functionId: string
  version: string

  // Execution metrics
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number

  // Resource usage
  averageMemoryUsage: number
  peakMemoryUsage: number
  averageDbOperations: number

  // Error metrics
  errorRate: number
  timeoutRate: number
  memoryLimitExceededRate: number

  // Cache metrics (for computed views)
  cacheHitRate?: number
  cacheMissRate?: number
  cacheInvalidationCount?: number

  // Time period
  periodStart: Date
  periodEnd: Date
}

export interface FunctionStats {
  functionId: string
  currentVersion: string
  totalExecutions: number
  lastExecutedAt?: Date
  averageExecutionTime: number
  errorRate: number
  cacheHitRate?: number
}

// ============================================================================
// Compilation & Sandbox
// ============================================================================

export interface CompilationResult {
  success: boolean
  compiledCode?: string
  sourceMap?: string
  errors?: TypeScriptError[]
  warnings?: TypeScriptWarning[]
}

export interface TypeScriptError {
  message: string
  line: number
  column: number
  code?: string
}

export interface TypeScriptWarning {
  message: string
  line: number
  column: number
  code?: string
}

export interface SandboxExecutionContext extends FunctionExecutionContext {
  // Restricted API access
  allowedModules: string[]
  networkAccess: boolean
  fileSystemAccess: boolean

  // Resource monitoring
  memoryMonitor: MemoryMonitor
  timeoutMonitor: TimeoutMonitor
  operationCounter: OperationCounter
}

export interface MemoryMonitor {
  getCurrentUsage(): number
  getMaxUsage(): number
  checkLimit(limit: number): boolean
}

export interface TimeoutMonitor {
  start(timeout: number): void
  stop(): void
  getRemainingTime(): number
}

export interface OperationCounter {
  increment(operation: string): void
  getCount(operation: string): number
  checkLimit(operation: string, limit: number): boolean
}

// ============================================================================
// Deployment Results
// ============================================================================

export interface DeploymentResult {
  deploymentId: string
  success: boolean
  environment?: string
  version: string
  deployedAt: Date
  error?: string
}

export interface ABTest {
  id: string
  functionId: string
  config: ABTestConfig
  status: 'running' | 'completed' | 'stopped'
  startedAt: Date
  endedAt?: Date
  metrics: Map<string, any>
  participants: Map<string, string> // userId -> version
}

export interface ABTestResult {
  testId: string
  winner?: string
  confidence: number
  metrics: Record<string, any>
  recommendation: 'continue' | 'stop' | 'extend'
}

// ============================================================================
// Error Types
// ============================================================================

export class FunctionExecutionError extends Error {
  override name = 'FunctionExecutionError'

  constructor(
    message: string,
    public functionId: string,
    public executionId: string,
    public override cause?: Error
  ) {
    super(message)
  }
}

export class FunctionCompilationError extends Error {
  override name = 'FunctionCompilationError'

  constructor(
    message: string,
    public functionId: string,
    public errors: TypeScriptError[]
  ) {
    super(message)
  }
}

export class ResourceLimitExceededError extends Error {
  override name = 'ResourceLimitExceededError'

  constructor(
    message: string,
    public resource: string,
    public limit: number,
    public actual: number
  ) {
    super(message)
  }
}

export class AuthorizationError extends Error {
  override name = 'AuthorizationError'

  constructor(message: string, public userId: string, public resource: string) {
    super(message)
  }
}

export class ValidationError extends Error {
  override name = 'ValidationError'

  constructor(message: string, public errors: any[]) {
    super(message)
  }
}

// ============================================================================
// Additional Types for Engine Interface
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  errors: ValidationErrorDetail[]
  warnings: ValidationWarningDetail[]
  suggestions: string[]
}

export interface ValidationErrorDetail {
  code: string
  message: string
  field?: string
  line?: number
  column?: number
}

export interface ValidationWarningDetail {
  code: string
  message: string
  field?: string
  suggestion?: string
}

export interface TestCase {
  name: string
  description?: string
  parameters: Record<string, any>
  expectedResult?: any
  expectedError?: string
  timeout?: number
}

export interface TestResult {
  testCase: TestCase
  success: boolean
  result?: any
  error?: string
  executionTime: number
  timestamp: Date
}

export interface FunctionEvent {
  type: 'function_registered' | 'function_executed' | 'function_failed' | 'cache_invalidated' | 'deployment_started' | 'deployment_completed'
  functionId: string
  timestamp: Date
  data?: Record<string, any>
  userId?: string
  requestId?: string
}