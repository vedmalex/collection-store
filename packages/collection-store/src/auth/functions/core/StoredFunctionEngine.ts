// Stored Functions Engine - Main Implementation
// Phase 1.6 Implementation

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import { createHash } from 'crypto'

import type { CSDatabase } from '../../../core/Database'
import type { IAuthManager } from '../../interfaces/IAuthManager'
import type { IAuditLogger } from '../../interfaces/IAuditLogger'

import type {
  IStoredFunctionEngine,
  IStoredFunctionEngineFactory,
  StoredFunctionEngineConfig,
  FunctionFilter,
  TimeRange,
  CacheStats,
  FunctionCacheStats,
  HealthStatus,
  HealthIssue,
  IFunctionEventListener
} from '../interfaces/IStoredFunctionEngine'

import type {
  StoredFunctionDefinition,
  FunctionExecutionContext,
  FunctionResult,
  ComputedViewResult,
  ProcedureResult,
  FunctionStats,
  PerformanceMetrics,
  DeploymentResult,
  DeploymentStrategy,
  ABTestConfig,
  ABTest,
  ABTestResult,
  ValidationResult,
  TestCase,
  TestResult,
  FunctionEvent
} from '../interfaces/types'

import {
  FunctionExecutionError,
  AuthorizationError,
  ValidationError,
  ResourceLimitExceededError
} from '../interfaces/types'

import type { IFunctionSandbox } from '../interfaces/IFunctionSandbox'
import { SimpleFunctionSandbox } from './SimpleFunctionSandbox'
import { ComputedViewManager } from '../views/ComputedViewManager'
import { StoredProcedureManager } from '../procedures/StoredProcedureManager'
import { DeploymentManager } from '../deployment/DeploymentManager'

/**
 * Main Stored Functions Engine Implementation
 * Handles function registration, execution, caching, and deployment
 */
export class StoredFunctionEngine extends EventEmitter implements IStoredFunctionEngine {
  private functions = new Map<string, StoredFunctionDefinition>()
  private functionStats = new Map<string, FunctionStats>()
  private performanceMetrics = new Map<string, PerformanceMetrics>()
  private activeExecutions = new Map<string, any>()
  private healthIssues: HealthIssue[] = []

  private sandbox: IFunctionSandbox
  private computedViewManager: ComputedViewManager
  private storedProcedureManager: StoredProcedureManager
  private deploymentManager: DeploymentManager

  private isInitialized = false
  private startTime = Date.now()

  constructor(
    private database: CSDatabase,
    private authManager: IAuthManager,
    private auditLogger: IAuditLogger,
    private config: StoredFunctionEngineConfig,
    private logger: Console = console
  ) {
    super()

    // Initialize components
    this.sandbox = new SimpleFunctionSandbox(
      this.createSandboxConfig(),
      this.logger,
      this.config.sandbox.provider
    )

    this.computedViewManager = new ComputedViewManager(this, this.config.cache)
    this.storedProcedureManager = new StoredProcedureManager(this, this.database)
    this.deploymentManager = new DeploymentManager(this, this.config.deployment)
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      this.logger.info('[StoredFunctionEngine] Initializing...')

      // Initialize sandbox
      await this.sandbox.initialize()

      // Initialize managers
      await this.computedViewManager.initialize()
      await this.storedProcedureManager.initialize()
      await this.deploymentManager.initialize()

      // Load existing functions from database
      await this.loadFunctionsFromDatabase()

      this.isInitialized = true
      this.logger.info('[StoredFunctionEngine] Initialization completed')

      // Emit initialization event
      await this.emit({
        type: 'function_registered',
        functionId: 'engine',
        timestamp: new Date(),
        data: { action: 'engine_initialized' }
      })
    } catch (error) {
      this.logger.error('[StoredFunctionEngine] Initialization failed:', error)
      throw error
    }
  }

  // ============================================================================
  // Function Management
  // ============================================================================

  async registerFunction(definition: StoredFunctionDefinition): Promise<void> {
    this.logger.info(`[StoredFunctionEngine] Registering function: ${definition.id}`)

    try {
      // Validate function definition
      const validation = await this.validateFunction(definition)
      if (!validation.isValid) {
        throw new ValidationError(
          `Function validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors
        )
      }

      // Compile TypeScript code
      const compilation = await this.sandbox.compileTypeScript(
        definition.implementation.code,
        definition.typeDefinitions
      )

      if (!compilation.success) {
        throw new ValidationError(
          'Function compilation failed',
          compilation.errors || []
        )
      }

      // Update definition with compiled code
      definition.implementation.compiledCode = compilation.compiledCode
      definition.implementation.sourceMap = compilation.sourceMap

      // Store in database
      await this.storeFunctionInDatabase(definition)

      // Store in memory
      this.functions.set(definition.id, definition)

      // Initialize stats
      this.functionStats.set(definition.id, {
        functionId: definition.id,
        currentVersion: definition.version,
        totalExecutions: 0,
        averageExecutionTime: 0,
        errorRate: 0,
        cacheHitRate: definition.type === 'computed_view' ? 0 : undefined
      })

      // Audit log
      await this.auditLogger.log({
        action: 'function_registered',
        userId: definition.createdBy,
        resource: `function:${definition.id}`,
        result: 'success',
        details: {
          functionType: definition.type,
          version: definition.version
        }
      })

      // Emit event
      await this.emit({
        type: 'function_registered',
        functionId: definition.id,
        timestamp: new Date(),
        userId: definition.createdBy
      })

      this.logger.info(`[StoredFunctionEngine] Function registered successfully: ${definition.id}`)
    } catch (error) {
      this.logger.error(`[StoredFunctionEngine] Failed to register function ${definition.id}:`, error)

      // Audit log failure
      await this.auditLogger.log({
        action: 'function_registration_failed',
        userId: definition.createdBy,
        resource: `function:${definition.id}`,
        result: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })

      throw error
    }
  }

  async unregisterFunction(functionId: string): Promise<void> {
    this.logger.info(`[StoredFunctionEngine] Unregistering function: ${functionId}`)

    const definition = this.functions.get(functionId)
    if (!definition) {
      throw new Error(`Function ${functionId} not found`)
    }

    try {
      // Remove from database
      await this.removeFunctionFromDatabase(functionId)

      // Remove from memory
      this.functions.delete(functionId)
      this.functionStats.delete(functionId)
      this.performanceMetrics.delete(functionId)

      // Clear caches
      await this.invalidateCache(functionId)

      // Emit event
      await this.emit({
        type: 'function_registered',
        functionId,
        timestamp: new Date(),
        data: { action: 'unregistered' }
      })

      this.logger.info(`[StoredFunctionEngine] Function unregistered: ${functionId}`)
    } catch (error) {
      this.logger.error(`[StoredFunctionEngine] Failed to unregister function ${functionId}:`, error)
      throw error
    }
  }

  async updateFunction(functionId: string, definition: StoredFunctionDefinition): Promise<void> {
    this.logger.info(`[StoredFunctionEngine] Updating function: ${functionId}`)

    const existingDefinition = this.functions.get(functionId)
    if (!existingDefinition) {
      throw new Error(`Function ${functionId} not found`)
    }

    try {
      // Validate new definition
      const validation = await this.validateFunction(definition)
      if (!validation.isValid) {
        throw new ValidationError(
          `Function validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors
        )
      }

      // Use deployment strategy for updates
      await this.deployFunction(definition, definition.deploymentStrategy)

      this.logger.info(`[StoredFunctionEngine] Function updated: ${functionId}`)
    } catch (error) {
      this.logger.error(`[StoredFunctionEngine] Failed to update function ${functionId}:`, error)
      throw error
    }
  }

  async getFunctionDefinition(functionId: string): Promise<StoredFunctionDefinition> {
    const definition = this.functions.get(functionId)
    if (!definition) {
      throw new Error(`Function ${functionId} not found`)
    }
    return { ...definition } // Return copy
  }

  async listFunctions(filter?: FunctionFilter): Promise<StoredFunctionDefinition[]> {
    let functions = Array.from(this.functions.values())

    if (filter) {
      functions = functions.filter(func => {
        if (filter.type && func.type !== filter.type) return false
        if (filter.status) {
          const status = func.isActive ? 'active' : 'inactive'
          if (status !== filter.status) return false
        }
        if (filter.createdBy && func.createdBy !== filter.createdBy) return false
        if (filter.namePattern && !func.name.includes(filter.namePattern)) return false
        if (filter.createdAfter && func.createdAt < filter.createdAfter) return false
        if (filter.createdBefore && func.createdAt > filter.createdBefore) return false
        return true
      })
    }

    return functions.map(func => ({ ...func })) // Return copies
  }

  // ============================================================================
  // Function Execution
  // ============================================================================

  async executeFunction(
    functionId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<FunctionResult> {
    const executionId = this.generateExecutionId()
    const startTime = performance.now()

    try {
      this.logger.debug(`[StoredFunctionEngine] Executing function ${functionId} (${executionId})`)

      // Get function definition
      const definition = await this.getFunctionDefinition(functionId)

      // Check authorization
      await this.checkExecutionPermission(definition, context.currentUser)

      // Validate parameters
      await this.validateParameters(parameters, definition.parameters)

      // Track execution
      this.activeExecutions.set(executionId, {
        functionId,
        startTime: new Date(),
        context: context.currentUser
      })

      // Execute based on function type
      let result: FunctionResult

      switch (definition.type) {
        case 'computed_view':
          result = await this.getComputedView(functionId, parameters, context)
          break

        case 'stored_procedure':
          result = await this.executeProcedure(functionId, parameters, context)
          break

        case 'scalar_function':
        default:
          result = await this.executeScalarFunction(definition, parameters, context)
          break
      }

      const executionTime = performance.now() - startTime

      // Update stats
      await this.updateFunctionStats(functionId, executionTime, true)

      // Audit log
      await this.auditLogger.log({
        action: 'function_executed',
        userId: context.currentUser.id,
        resource: `function:${functionId}`,
        result: 'success',
        details: {
          executionTime,
          parametersHash: this.hashParameters(parameters)
        }
      })

      // Emit event
      await this.emit({
        type: 'function_executed',
        functionId,
        timestamp: new Date(),
        userId: context.currentUser.id,
        requestId: context.requestId,
        data: { executionTime, success: true }
      })

      this.logger.debug(`[StoredFunctionEngine] Function executed successfully: ${functionId} (${executionTime}ms)`)

      return result
    } catch (error) {
      const executionTime = performance.now() - startTime

      // Update stats
      await this.updateFunctionStats(functionId, executionTime, false)

      // Audit log failure
      await this.auditLogger.log({
        action: 'function_execution_failed',
        userId: context.currentUser.id,
        resource: `function:${functionId}`,
        result: 'failure',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime
        }
      })

      // Emit event
      await this.emit({
        type: 'function_failed',
        functionId,
        timestamp: new Date(),
        userId: context.currentUser.id,
        requestId: context.requestId,
        data: { executionTime, error: error instanceof Error ? error.message : 'Unknown error' }
      })

      this.logger.error(`[StoredFunctionEngine] Function execution failed: ${functionId}`, error)

      throw new FunctionExecutionError(
        `Function execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        functionId,
        executionId,
        error instanceof Error ? error : undefined
      )
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  async getComputedView(
    viewId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ComputedViewResult> {
    return this.computedViewManager.getComputedView(viewId, parameters, context)
  }

  async executeProcedure(
    procedureId: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<ProcedureResult> {
    return this.storedProcedureManager.executeProcedure(procedureId, parameters, context)
  }

  private async executeScalarFunction(
    definition: StoredFunctionDefinition,
    parameters: Record<string, any>,
    context: FunctionExecutionContext
  ): Promise<FunctionResult> {
    if (!definition.implementation.compiledCode) {
      throw new Error('Function not compiled')
    }

    // Create sandbox context
    const sandboxContext = {
      ...context,
      allowedModules: context.limits.allowedModules,
      networkAccess: false,
      fileSystemAccess: false,
      memoryMonitor: this.createMemoryMonitor(),
      timeoutMonitor: this.createTimeoutMonitor(),
      operationCounter: this.createOperationCounter()
    }

    // Execute in sandbox
    const result = await this.sandbox.executeInSandbox(
      definition.implementation.compiledCode,
      parameters,
      sandboxContext,
      context.limits
    )

    return {
      data: result,
      metadata: {
        functionId: definition.id,
        version: definition.version,
        executionTime: 0, // Will be set by caller
        fromCache: false
      }
    }
  }

  // ============================================================================
  // Deployment & Versioning
  // ============================================================================

  async deployFunction(
    definition: StoredFunctionDefinition,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult> {
    return this.deploymentManager.deployFunction(definition, strategy)
  }

  async rollbackFunction(functionId: string, targetVersion?: string): Promise<DeploymentResult> {
    return this.deploymentManager.rollbackFunction(functionId, targetVersion)
  }

  async createABTest(functionId: string, config: ABTestConfig): Promise<ABTest> {
    return this.deploymentManager.createABTest(functionId, config)
  }

  async evaluateABTest(testId: string): Promise<ABTestResult> {
    return this.deploymentManager.evaluateABTest(testId)
  }

  // ============================================================================
  // Monitoring & Analytics
  // ============================================================================

  async getFunctionStats(functionId: string, timeRange?: TimeRange): Promise<FunctionStats> {
    const stats = this.functionStats.get(functionId)
    if (!stats) {
      throw new Error(`Function stats for ${functionId} not found`)
    }
    return { ...stats }
  }

  async getPerformanceMetrics(functionId: string, timeRange?: TimeRange): Promise<PerformanceMetrics> {
    const metrics = this.performanceMetrics.get(functionId)
    if (!metrics) {
      // Create default metrics if not found
      return {
        functionId,
        version: '1.0.0',
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        averageDbOperations: 0,
        errorRate: 0,
        timeoutRate: 0,
        memoryLimitExceededRate: 0,
        periodStart: new Date(),
        periodEnd: new Date()
      }
    }
    return { ...metrics }
  }

  async getCacheStats(functionId?: string): Promise<CacheStats> {
    return this.computedViewManager.getCacheStats(functionId)
  }

  async getFunctionCacheStats(functionId: string): Promise<FunctionCacheStats> {
    return this.computedViewManager.getFunctionCacheStats(functionId)
  }

  // ============================================================================
  // Health & Validation
  // ============================================================================

  async validateFunction(definition: StoredFunctionDefinition): Promise<ValidationResult> {
    const errors: any[] = []
    const warnings: any[] = []
    const suggestions: string[] = []

    // Basic validation
    if (!definition.id) {
      errors.push({ code: 'MISSING_ID', message: 'Function ID is required' })
    }

    if (!definition.name) {
      errors.push({ code: 'MISSING_NAME', message: 'Function name is required' })
    }

    if (!definition.implementation?.code) {
      errors.push({ code: 'MISSING_CODE', message: 'Function implementation code is required' })
    }

    // Security validation
    if (definition.security.executionMode !== 'caller_rights') {
      errors.push({ code: 'INVALID_EXECUTION_MODE', message: 'Only caller_rights execution mode is allowed' })
    }

    // TypeScript validation
    if (definition.implementation?.code) {
      const securityValidation = await this.sandbox.validateSecurity(definition.implementation.code)
      if (!securityValidation.safe) {
        securityValidation.issues.forEach(issue => {
          if (issue.severity === 'critical') {
            errors.push({
              code: issue.type.toUpperCase(),
              message: issue.message,
              line: issue.line,
              column: issue.column
            })
          } else {
            warnings.push({
              code: issue.type.toUpperCase(),
              message: issue.message,
              suggestion: 'Review and remove dangerous code patterns'
            })
          }
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  async testFunction(functionId: string, testCases: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (const testCase of testCases) {
      const startTime = performance.now()

      try {
        // Create test context
        const testContext: FunctionExecutionContext = {
          currentUser: {
            id: 'test-user',
            email: 'test@example.com',
            roles: ['user'],
            permissions: [],
            attributes: {}
          },
          database: this.database,
          requestId: `test-${Date.now()}`,
          timestamp: new Date(),
          limits: {
            maxExecutionTime: testCase.timeout || 30000,
            maxMemoryUsage: 50 * 1024 * 1024,
            maxDbOperations: 1000,
            maxNetworkRequests: 0,
            allowedModules: []
          }
        }

        const result = await this.executeFunction(functionId, testCase.parameters, testContext)
        const executionTime = performance.now() - startTime

        let success = true
        let error: string | undefined

        // Check expected result
        if (testCase.expectedResult !== undefined) {
          if (JSON.stringify(result.data) !== JSON.stringify(testCase.expectedResult)) {
            success = false
            error = `Expected ${JSON.stringify(testCase.expectedResult)}, got ${JSON.stringify(result.data)}`
          }
        }

        results.push({
          testCase,
          success,
          result: result.data,
          error,
          executionTime,
          timestamp: new Date()
        })
      } catch (err) {
        const executionTime = performance.now() - startTime
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'

        let success = false
        if (testCase.expectedError && errorMessage.includes(testCase.expectedError)) {
          success = true
        }

        results.push({
          testCase,
          success,
          error: errorMessage,
          executionTime,
          timestamp: new Date()
        })
      }
    }

    return results
  }

  async healthCheck(): Promise<HealthStatus> {
    const checks: any[] = []
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Check sandbox health
    try {
      const sandboxCheck = await this.checkSandboxHealth()
      checks.push(sandboxCheck)
      if (sandboxCheck.status !== 'pass') {
        overallStatus = sandboxCheck.status === 'warn' ? 'degraded' : 'unhealthy'
      }
    } catch (error) {
      checks.push({
        name: 'sandbox',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        timestamp: new Date()
      })
      overallStatus = 'unhealthy'
    }

    // Check database connectivity
    try {
      const dbCheck = await this.checkDatabaseHealth()
      checks.push(dbCheck)
      if (dbCheck.status !== 'pass') {
        overallStatus = dbCheck.status === 'warn' ? 'degraded' : 'unhealthy'
      }
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        timestamp: new Date()
      })
      overallStatus = 'unhealthy'
    }

    return {
      status: overallStatus,
      uptime: Date.now() - this.startTime,
      version: '1.6.0',
      timestamp: new Date(),
      checks
    }
  }

  async getHealthIssues(): Promise<HealthIssue[]> {
    return [...this.healthIssues]
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  async invalidateCache(functionId: string, pattern?: string): Promise<void> {
    await this.computedViewManager.invalidateCache(functionId, pattern)

    // Emit cache invalidation event
    await this.emit({
      type: 'cache_invalidated',
      functionId,
      timestamp: new Date(),
      data: { pattern }
    })
  }

  async clearAllCaches(): Promise<void> {
    await this.computedViewManager.clearAllCaches()
    await this.sandbox.clearCompilationCache()
  }

  async warmUpCache(functionId: string, parameters: Record<string, any>[]): Promise<void> {
    await this.computedViewManager.warmUpCache(functionId, parameters)
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  on(event: string, listener: IFunctionEventListener): void {
    super.on(event, listener)
  }

  off(event: string, listener: IFunctionEventListener): void {
    super.off(event, listener)
  }

  async emit(event: FunctionEvent): Promise<void> {
    super.emit(event.type, event)
    super.emit('*', event) // Emit to wildcard listeners
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  getConfig(): StoredFunctionEngineConfig {
    return { ...this.config }
  }

  async updateConfig(config: Partial<StoredFunctionEngineConfig>): Promise<void> {
    Object.assign(this.config, config)
    // TODO: Apply configuration changes to components
  }

  async dispose(): Promise<void> {
    this.logger.info('[StoredFunctionEngine] Disposing...')

    // Dispose components
    await this.sandbox.dispose()
    await this.computedViewManager.dispose()
    await this.storedProcedureManager.dispose()
    await this.deploymentManager.dispose()

    // Clear data
    this.functions.clear()
    this.functionStats.clear()
    this.performanceMetrics.clear()
    this.activeExecutions.clear()
    this.healthIssues.length = 0

    // Remove all listeners
    this.removeAllListeners()

    this.isInitialized = false
    this.logger.info('[StoredFunctionEngine] Disposed')
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private createSandboxConfig(): any {
    return {
      typescript: {
        target: 'ES2020',
        module: 'CommonJS',
        strict: true
      },
      limits: {
        maxExecutionTime: this.config.security.maxExecutionTime,
        maxMemoryUsage: this.config.security.maxMemoryUsage,
        maxDbOperations: this.config.security.maxDbOperations,
        maxNetworkRequests: 0,
        allowedModules: this.config.sandbox.allowedModules
      },
      security: {
        allowEval: false,
        allowFunction: false,
        allowAsyncFunction: true
      },
      modules: {
        allowedModules: this.config.sandbox.allowedModules,
        blockedModules: this.config.sandbox.blockedModules
      },
      monitoring: {
        enabled: this.config.monitoring.enabled
      }
    }
  }

  private async checkExecutionPermission(
    definition: StoredFunctionDefinition,
    user: any
  ): Promise<void> {
    // Check if user has required roles
    const hasRole = definition.security.allowedRoles.some(role =>
      user.roles.includes(role)
    )

    if (!hasRole) {
      throw new AuthorizationError(
        `User ${user.id} does not have permission to execute function ${definition.id}`,
        user.id,
        `function:${definition.id}`
      )
    }
  }

  private async validateParameters(
    parameters: Record<string, any>,
    parameterDefinitions: any[]
  ): Promise<void> {
    for (const paramDef of parameterDefinitions) {
      const value = parameters[paramDef.name]

      if (paramDef.required && (value === undefined || value === null)) {
        throw new ValidationError(
          `Required parameter '${paramDef.name}' is missing`,
          [{ field: paramDef.name, message: 'Required parameter is missing' }]
        )
      }

      // TODO: Add more parameter validation (type checking, etc.)
    }
  }

  private async updateFunctionStats(
    functionId: string,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    const stats = this.functionStats.get(functionId)
    if (stats) {
      stats.totalExecutions++
      stats.lastExecutedAt = new Date()

      // Update average execution time
      const totalTime = stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime
      stats.averageExecutionTime = totalTime / stats.totalExecutions

      // Update error rate
      if (!success) {
        const errorCount = Math.round(stats.errorRate * (stats.totalExecutions - 1))
        stats.errorRate = (errorCount + 1) / stats.totalExecutions
      } else {
        const errorCount = Math.round(stats.errorRate * (stats.totalExecutions - 1))
        stats.errorRate = errorCount / stats.totalExecutions
      }
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private hashParameters(parameters: Record<string, any>): string {
    return createHash('sha256').update(JSON.stringify(parameters)).digest('hex').substring(0, 16)
  }

  private createMemoryMonitor(): any {
    return {
      getCurrentUsage: () => process.memoryUsage().heapUsed,
      getMaxUsage: () => process.memoryUsage().heapTotal,
      checkLimit: (limit: number) => process.memoryUsage().heapUsed < limit
    }
  }

  private createTimeoutMonitor(): any {
    let startTime = Date.now()
    let timeout = 0

    return {
      start: (timeoutMs: number) => {
        startTime = Date.now()
        timeout = timeoutMs
      },
      stop: () => {
        timeout = 0
      },
      getRemainingTime: () => Math.max(0, timeout - (Date.now() - startTime))
    }
  }

  private createOperationCounter(): any {
    const counts = new Map<string, number>()

    return {
      increment: (operation: string) => {
        counts.set(operation, (counts.get(operation) || 0) + 1)
      },
      getCount: (operation: string) => counts.get(operation) || 0,
      checkLimit: (operation: string, limit: number) => (counts.get(operation) || 0) < limit
    }
  }

  private async loadFunctionsFromDatabase(): Promise<void> {
    // TODO: Implement loading functions from database
    this.logger.info('[StoredFunctionEngine] Loading functions from database...')
  }

  private async storeFunctionInDatabase(definition: StoredFunctionDefinition): Promise<void> {
    // TODO: Implement storing function in database
    this.logger.debug(`[StoredFunctionEngine] Storing function in database: ${definition.id}`)
  }

  private async removeFunctionFromDatabase(functionId: string): Promise<void> {
    // TODO: Implement removing function from database
    this.logger.debug(`[StoredFunctionEngine] Removing function from database: ${functionId}`)
  }

  private async checkSandboxHealth(): Promise<any> {
    const startTime = performance.now()

    try {
      // Test basic sandbox functionality
      const testCode = 'return 42'
      const testContext = {
        currentUser: { id: 'health-check', email: 'health@test.com', roles: [], permissions: [], attributes: {} },
        database: this.database,
        requestId: 'health-check',
        timestamp: new Date(),
        allowedModules: [],
        networkAccess: false,
        fileSystemAccess: false,
        memoryMonitor: this.createMemoryMonitor(),
        timeoutMonitor: this.createTimeoutMonitor(),
        operationCounter: this.createOperationCounter()
      }

      const result = await this.sandbox.executeInSandbox(
        testCode,
        {},
        testContext,
        { maxExecutionTime: 1000, maxMemoryUsage: 10 * 1024 * 1024, maxDbOperations: 0, maxNetworkRequests: 0, allowedModules: [] }
      )

      const duration = performance.now() - startTime

      if (result === 42) {
        return {
          name: 'sandbox',
          status: 'pass',
          message: 'Sandbox is healthy',
          duration,
          timestamp: new Date()
        }
      } else {
        return {
          name: 'sandbox',
          status: 'warn',
          message: 'Sandbox returned unexpected result',
          duration,
          timestamp: new Date()
        }
      }
    } catch (error) {
      return {
        name: 'sandbox',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: performance.now() - startTime,
        timestamp: new Date()
      }
    }
  }

  private async checkDatabaseHealth(): Promise<any> {
    const startTime = performance.now()

    try {
      // Test basic database connectivity
      // TODO: Implement actual database health check
      const duration = performance.now() - startTime

      return {
        name: 'database',
        status: 'pass',
        message: 'Database is healthy',
        duration,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: performance.now() - startTime,
        timestamp: new Date()
      }
    }
  }
}

/**
 * Factory for creating Stored Function Engine instances
 */
export class StoredFunctionEngineFactory implements IStoredFunctionEngineFactory {
  async create(config: StoredFunctionEngineConfig): Promise<IStoredFunctionEngine> {
    // TODO: Inject actual dependencies
    const database = {} as CSDatabase
    const authManager = {} as IAuthManager
    const auditLogger = {} as IAuditLogger

    const engine = new StoredFunctionEngine(database, authManager, auditLogger, config)
    await engine.initialize()
    return engine
  }

  getAvailableEngines(): string[] {
    return ['default']
  }

  async isEngineAvailable(engineType: string): Promise<boolean> {
    return engineType === 'default'
  }
}