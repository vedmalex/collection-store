// Main interface for Stored Functions & Procedures Engine
import type {
  StoredFunctionDefinition,
  FunctionExecutionContext,
  FunctionResult,
  ComputedViewResult,
  ProcedureResult,
  FunctionStats,
  PerformanceMetrics,
  DeploymentStrategy,
  DeploymentResult,
  ABTestConfig,
  ABTest,
  ABTestResult,
  ValidationResult,
  TestCase,
  TestResult,
  FunctionEvent
} from './types'

/**
 * Main interface for Stored Functions & Procedures Engine
 * Provides TypeScript-based function execution with security and performance monitoring
 */
export interface IStoredFunctionEngine {
  // ============================================================================
  // Function Management
  // ============================================================================

  /**
   * Register a new stored function with TypeScript implementation
   */
  registerFunction(definition: StoredFunctionDefinition): Promise<void>

  /**
   * Unregister a stored function
   */
  unregisterFunction(functionId: string): Promise<void>

  /**
   * Update an existing stored function
   */
  updateFunction(functionId: string, definition: StoredFunctionDefinition): Promise<void>

  /**
   * Get function definition by ID
   */
  getFunctionDefinition(functionId: string): Promise<StoredFunctionDefinition>

  /**
   * List all registered functions
   */
  listFunctions(filter?: FunctionFilter): Promise<StoredFunctionDefinition[]>

  // ============================================================================
  // Function Execution
  // ============================================================================

  /**
   * Execute a stored function with parameters
   */
  executeFunction(
    functionId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<FunctionResult>

  /**
   * Execute a stored procedure with transaction support
   */
  executeProcedure(
    procedureId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ProcedureResult>

  /**
   * Get computed view result with caching
   */
  getComputedView(
    viewId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ComputedViewResult>

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate cache for specific view
   */
  invalidateViewCache(viewId: string, parameters?: Record<string, any>): Promise<void>

  /**
   * Refresh materialized view
   */
  refreshMaterializedView(viewId: string): Promise<void>

  /**
   * Clear all function caches
   */
  clearAllCaches(): Promise<void>

  /**
   * Get cache statistics
   */
  getCacheStats(): Promise<CacheStats>

  // ============================================================================
  // Deployment & Versioning
  // ============================================================================

  /**
   * Deploy function with specified strategy
   */
  deployFunction(
    definition: StoredFunctionDefinition,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult>

  /**
   * Deploy specific version of function
   */
  deployVersion(functionId: string, version: string, strategy: DeploymentStrategy): Promise<void>

  /**
   * Rollback to previous version
   */
  rollbackVersion(functionId: string, targetVersion: string): Promise<void>

  /**
   * Enable A/B testing for function
   */
  enableABTesting(functionId: string, config: ABTestConfig): Promise<ABTest>

  /**
   * Stop A/B test and get results
   */
  stopABTest(testId: string, winningVersion?: string): Promise<ABTestResult>

  // ============================================================================
  // Monitoring & Analytics
  // ============================================================================

  /**
   * Get function execution statistics
   */
  getFunctionStats(functionId: string): Promise<FunctionStats>

  /**
   * Get detailed performance metrics
   */
  getPerformanceMetrics(functionId: string, timeRange?: TimeRange): Promise<PerformanceMetrics>

  /**
   * Get execution history
   */
  getExecutionHistory(functionId: string, limit?: number): Promise<ExecutionLog[]>

  /**
   * Get real-time function health status
   */
  getHealthStatus(functionId: string): Promise<HealthStatus>

  // ============================================================================
  // Hot Reload & Development
  // ============================================================================

  /**
   * Reload function from source (development mode)
   */
  reloadFunction(functionId: string): Promise<void>

  /**
   * Validate function definition without deploying
   */
  validateFunction(definition: StoredFunctionDefinition): Promise<ValidationResult>

  /**
   * Test function execution with mock data
   */
  testFunction(
    functionId: string,
    testCases: TestCase[],
    context: FunctionExecutionContext
  ): Promise<TestResult[]>

  // ============================================================================
  // Health & Validation
  // ============================================================================

  /**
   * Health check for the engine
   */
  healthCheck(): Promise<HealthStatus>

  /**
   * Get health issues
   */
  getHealthIssues(): Promise<HealthIssue[]>

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to function events
   */
  on(event: string, listener: IFunctionEventListener): void

  /**
   * Unsubscribe from function events
   */
  off(event: string, listener: IFunctionEventListener): void

  /**
   * Emit function event
   */
  emit(event: FunctionEvent): Promise<void>

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get engine configuration
   */
  getConfig(): StoredFunctionEngineConfig

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<StoredFunctionEngineConfig>): Promise<void>

  /**
   * Dispose resources and cleanup
   */
  dispose(): Promise<void>
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface FunctionFilter {
  type?: 'computed_view' | 'stored_procedure' | 'scalar_function'
  isActive?: boolean
  createdBy?: string
  tags?: string[]
  search?: string
}

export interface CacheStats {
  totalCacheSize: number
  hitRate: number
  missRate: number
  evictionCount: number
  memoryUsage: number
  cachesByFunction: Record<string, FunctionCacheStats>
}

export interface FunctionCacheStats {
  functionId: string
  cacheSize: number
  hitCount: number
  missCount: number
  lastAccessed: Date
  memoryUsage: number
}

export interface TimeRange {
  start: Date
  end: Date
}

export interface ExecutionLog {
  id: string
  functionId: string
  version: string
  executedAt: Date
  executionTime: number
  success: boolean
  error?: string
  userId: string
  parameters: Record<string, any>
  result?: any
}

export interface HealthStatus {
  functionId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastExecution: Date
  errorRate: number
  averageExecutionTime: number
  issues: HealthIssue[]
}

export interface HealthIssue {
  type: 'performance' | 'error' | 'resource' | 'dependency'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  detectedAt: Date
  count: number
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: string[]
}

export interface ValidationError {
  type: 'syntax' | 'type' | 'security' | 'dependency'
  message: string
  line?: number
  column?: number
  code?: string
}

export interface ValidationWarning {
  type: 'performance' | 'security' | 'best_practice'
  message: string
  line?: number
  column?: number
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
  memoryUsage: number
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface StoredFunctionEngineConfig {
  // Execution settings
  defaultTimeout: number
  defaultMemoryLimit: number
  defaultDbOperationLimit: number

  // Security settings
  sandboxEnabled: boolean
  allowedModules: string[]
  networkAccess: boolean
  fileSystemAccess: boolean

  // Cache settings
  cacheEnabled: boolean
  defaultCacheTTL: number
  maxCacheSize: number

  // Monitoring settings
  metricsEnabled: boolean
  healthCheckInterval: number
  performanceThresholds: PerformanceThresholds

  // Development settings
  hotReloadEnabled: boolean
  debugMode: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
}

export interface PerformanceThresholds {
  maxExecutionTime: number
  maxMemoryUsage: number
  maxErrorRate: number
  maxCacheSize: number
}

// ============================================================================
// Event Interfaces
// ============================================================================

export interface FunctionEvent {
  type: 'execution_start' | 'execution_end' | 'execution_error' | 'cache_hit' | 'cache_miss' | 'deployment'
  functionId: string
  timestamp: Date
  data: Record<string, any>
}

export interface IFunctionEventListener {
  onFunctionEvent(event: FunctionEvent): Promise<void>
}

// ============================================================================
// Factory Interface
// ============================================================================

export interface IStoredFunctionEngineFactory {
  create(config: StoredFunctionEngineConfig): Promise<IStoredFunctionEngine>
  createWithDefaults(): Promise<IStoredFunctionEngine>
}