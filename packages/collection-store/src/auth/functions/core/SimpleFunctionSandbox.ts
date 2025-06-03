// Simplified TypeScript Function Sandbox Implementation
// Enhanced version with proper TypeScript transpilation
import { createHash } from 'crypto'
import { performance } from 'perf_hooks'
import * as vm from 'vm'

import type {
  IFunctionSandbox,
  CompilationResult,
  SandboxExecutionContext,
  ResourceLimits,
  FunctionExecutionContext,
  TypeValidationResult,
  TypeScriptDiagnostic,
  ExecutionMonitor,
  ExecutionStats,
  SecurityValidationResult,
  CachedCode,
  SandboxConfig,
  SandboxEnvironment
} from '../interfaces'

import { ResourceLimitExceededError, FunctionCompilationError } from '../interfaces/types'
import type { ITypeScriptTranspiler } from '../interfaces/ITypeScriptTranspiler'
import { TypeScriptTranspilerFactory, getDefaultTranspilerConfig } from '../transpilers/TypeScriptTranspilerFactory'

/**
 * Enhanced TypeScript Function Sandbox
 * Uses pluggable TypeScript transpilers for proper compilation
 */
export class SimpleFunctionSandbox implements IFunctionSandbox {
  private compilationCache = new Map<string, CachedCode>()
  private activeExecutions = new Map<string, ExecutionMonitor>()
  private executionStats = new Map<string, ExecutionStats>()
  private transpiler: ITypeScriptTranspiler | null = null
  private transpilerFactory: TypeScriptTranspilerFactory

  constructor(
    private config: SandboxConfig,
    private logger: Console = console,
    private transpilerProvider: 'esbuild' | 'swc' | 'typescript' = 'esbuild'
  ) {
    this.transpilerFactory = TypeScriptTranspilerFactory.getInstance()
  }

  async initialize(): Promise<void> {
    try {
      const transpilerConfig = getDefaultTranspilerConfig(this.transpilerProvider)
      this.transpiler = await this.transpilerFactory.create(transpilerConfig)
      this.logger.info(`[SimpleFunctionSandbox] Initialized with ${this.transpilerProvider} transpiler`)
    } catch (error) {
      this.logger.warn(`[SimpleFunctionSandbox] Failed to initialize ${this.transpilerProvider} transpiler, falling back to basic compilation`)
      this.transpiler = null
    }
  }

  // ============================================================================
  // Compilation (Simplified)
  // ============================================================================

  async compileTypeScript(code: string, types?: string): Promise<CompilationResult> {
    try {
      this.logger.debug('[SimpleFunctionSandbox] Starting TypeScript compilation')

      // Initialize transpiler if not already done
      if (!this.transpiler) {
        await this.initialize()
      }

      // Check cache first
      const codeHash = this.generateCodeHash(code, types)
      const cached = await this.getCachedCompiledCode(codeHash)
      if (cached) {
        this.logger.debug('[SimpleFunctionSandbox] Using cached compilation result')
        return {
          success: true,
          compiledCode: cached.compiledCode,
          sourceMap: cached.sourceMap
        }
      }

      // Validate code security first
      const securityValidation = await this.validateSecurity(code)
      if (!securityValidation.safe) {
        return {
          success: false,
          errors: securityValidation.issues.map(issue => ({
            message: issue.message,
            line: issue.line || 0,
            column: issue.column || 0,
            code: issue.type
          }))
        }
      }

      let compiledCode: string
      let sourceMap: string | undefined

      // Use proper transpiler if available
      if (this.transpiler) {
        this.logger.debug('[SimpleFunctionSandbox] Using transpiler for compilation')

        const transpilationResult = await this.transpiler.transpile(code, 'function.ts')

        if (!transpilationResult.success) {
          return {
            success: false,
            errors: transpilationResult.errors?.map(error => ({
              message: error.message,
              line: error.line || 0,
              column: error.column || 0,
              code: error.code?.toString()
            })) || []
          }
        }

        compiledCode = transpilationResult.code || ''
        sourceMap = transpilationResult.sourceMap
      } else {
        // Fallback to basic compilation
        this.logger.debug('[SimpleFunctionSandbox] Using basic compilation fallback')
        compiledCode = this.basicTypeScriptToJavaScript(code)
      }

      this.logger.debug('[SimpleFunctionSandbox] Original code:', code)
      this.logger.debug('[SimpleFunctionSandbox] Compiled code:', compiledCode)

      // Cache the result
      await this.cacheCompiledCode(codeHash, compiledCode, sourceMap)

      this.logger.debug('[SimpleFunctionSandbox] TypeScript compilation successful')

      return {
        success: true,
        compiledCode,
        sourceMap,
        warnings: []
      }
    } catch (error) {
      this.logger.error('[SimpleFunctionSandbox] Compilation error:', error)
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown compilation error',
          line: 0,
          column: 0
        }]
      }
    }
  }

  async validateTypes(code: string, types?: string): Promise<TypeValidationResult> {
    // Basic validation - just check syntax
    try {
      new Function(code)
      return {
        valid: true,
        errors: [],
        warnings: [],
        typeInfo: []
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Syntax error',
          line: 0,
          column: 0,
          code: 'SYNTAX_ERROR'
        }],
        warnings: [],
        typeInfo: []
      }
    }
  }

  async getDiagnostics(code: string): Promise<TypeScriptDiagnostic[]> {
    // Basic syntax check
    try {
      new Function(code)
      return []
    } catch (error) {
      return [{
        category: 'error',
        code: 1,
        message: error instanceof Error ? error.message : 'Syntax error',
        line: 1,
        column: 1
      }]
    }
  }

  // ============================================================================
  // Execution
  // ============================================================================

  async executeInSandbox(
    compiledCode: string,
    parameters: Record<string, any>,
    context: SandboxExecutionContext,
    limits: ResourceLimits
  ): Promise<any> {
    const executionId = this.generateExecutionId()
    const startTime = performance.now()

    try {
      this.logger.debug(`[SimpleFunctionSandbox] Starting execution ${executionId}`)

      // Start monitoring
      const monitor = this.startExecutionMonitoring(executionId, limits)

      // Create sandbox environment
      const sandbox = this.createSandboxEnvironment(context, limits)

      // Prepare execution context
      const vmContext = vm.createContext({
        ...sandbox,
        parameters,
        exports: {},
        module: { exports: {} }
      })

      // Execute with timeout
      const result = await this.executeWithTimeout(
        compiledCode,
        vmContext,
        limits.maxExecutionTime,
        executionId
      )

      // Stop monitoring
      this.stopExecutionMonitoring(executionId)

      const executionTime = performance.now() - startTime
      this.logger.debug(`[SimpleFunctionSandbox] Execution ${executionId} completed in ${executionTime}ms`)

      // Record execution stats
      await this.recordExecutionStats(executionId, {
        duration: executionTime,
        memoryUsage: monitor.memoryUsage,
        success: true
      })

      return result
    } catch (error) {
      this.stopExecutionMonitoring(executionId)

      const executionTime = performance.now() - startTime
      this.logger.error(`[SimpleFunctionSandbox] Execution ${executionId} failed after ${executionTime}ms:`, error)

      // Record failure stats
      await this.recordExecutionStats(executionId, {
        duration: executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  async executeTypeScript(
    code: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext,
    limits: ResourceLimits
  ): Promise<any> {
    // Compile first
    const compilation = await this.compileTypeScript(code)

    if (!compilation.success) {
      throw new FunctionCompilationError(
        'TypeScript compilation failed',
        'unknown',
        compilation.errors || []
      )
    }

    // Convert to sandbox context
    const sandboxContext: SandboxExecutionContext = {
      ...context,
      allowedModules: limits.allowedModules,
      networkAccess: false,
      fileSystemAccess: false,
      memoryMonitor: this.createMemoryMonitor(),
      timeoutMonitor: this.createTimeoutMonitor(),
      operationCounter: this.createOperationCounter()
    }

    if (!compilation.compiledCode) {
      throw new Error('Compilation failed - no compiled code available')
    }

    return this.executeInSandbox(compilation.compiledCode, parameters, sandboxContext, limits)
  }

  // ============================================================================
  // Monitoring
  // ============================================================================

  async monitorExecution(executionId: string): Promise<ExecutionMonitor> {
    const monitor = this.activeExecutions.get(executionId)
    if (!monitor) {
      throw new Error(`Execution ${executionId} not found`)
    }
    return monitor
  }

  async terminateExecution(executionId: string): Promise<void> {
    const monitor = this.activeExecutions.get(executionId)
    if (monitor) {
      monitor.status = 'terminated'
      this.activeExecutions.delete(executionId)
      this.logger.warn(`[SimpleFunctionSandbox] Execution ${executionId} terminated`)
    }
  }

  async getExecutionStats(executionId: string): Promise<ExecutionStats> {
    const stats = this.executionStats.get(executionId)
    if (!stats) {
      throw new Error(`Execution stats for ${executionId} not found`)
    }
    return stats
  }

  // ============================================================================
  // Security
  // ============================================================================

  async validateSecurity(code: string): Promise<SecurityValidationResult> {
    const issues: any[] = []

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, type: 'eval_usage', severity: 'critical' as const, message: 'Use of eval() is not allowed' },
      { pattern: /Function\s*\(/, type: 'dangerous_function' as const, severity: 'critical' as const, message: 'Use of Function constructor is not allowed' },
      { pattern: /process\./g, type: 'module_access' as const, severity: 'high' as const, message: 'Access to process object is not allowed' },
      { pattern: /require\s*\(/g, type: 'module_access' as const, severity: 'medium' as const, message: 'Require usage detected - ensure module is allowed' },
      { pattern: /__proto__/g, type: 'prototype_pollution' as const, severity: 'high' as const, message: 'Prototype pollution attempt detected' },
      { pattern: /constructor\s*\[/g, type: 'prototype_pollution' as const, severity: 'high' as const, message: 'Constructor access detected' }
    ]

    const lines = code.split('\n')

    dangerousPatterns.forEach(({ pattern, type, severity, message }) => {
      lines.forEach((line, index) => {
        const matches = line.match(pattern)
        if (matches) {
          issues.push({
            type,
            severity,
            message,
            line: index + 1,
            column: line.indexOf(matches[0]) + 1
          })
        }
      })
    })

    return {
      safe: issues.filter(issue => issue.severity === 'critical').length === 0,
      issues,
      recommendations: issues.length > 0
        ? ['Review and remove dangerous code patterns', 'Use approved APIs only']
        : []
    }
  }

  isModuleAllowed(moduleName: string): boolean {
    return this.config.modules.allowedModules.includes(moduleName) &&
           !this.config.modules.blockedModules.includes(moduleName)
  }

  getSandboxConfig(): SandboxConfig {
    return { ...this.config }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  async cacheCompiledCode(codeHash: string, compiledCode: string, sourceMap?: string): Promise<void> {
    const cached: CachedCode = {
      codeHash,
      compiledCode,
      sourceMap,
      compiledAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date()
    }

    this.compilationCache.set(codeHash, cached)
  }

  async getCachedCompiledCode(codeHash: string): Promise<CachedCode | null> {
    const cached = this.compilationCache.get(codeHash)
    if (cached) {
      cached.accessCount++
      cached.lastAccessed = new Date()
      return cached
    }
    return null
  }

  async clearCompilationCache(): Promise<void> {
    this.compilationCache.clear()
    this.logger.info('[SimpleFunctionSandbox] Compilation cache cleared')
  }

  async dispose(): Promise<void> {
    // Dispose transpiler
    if (this.transpiler) {
      await this.transpiler.dispose()
      this.transpiler = null
    }

    // Clear caches and active executions
    this.compilationCache.clear()
    this.activeExecutions.clear()
    this.executionStats.clear()

    this.logger.info('[SimpleFunctionSandbox] Sandbox disposed')
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private basicTypeScriptToJavaScript(code: string): string {
    // Very basic TypeScript to JavaScript conversion
    // Remove type annotations and interfaces more carefully
    let jsCode = code
      // Remove interface declarations
      .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '')
      // Remove type aliases
      .replace(/type\s+\w+\s*=\s*[^;]+;?/gs, '')
      // Remove export keywords
      .replace(/export\s+/g, '')
      // Remove import statements
      .replace(/import\s+.*?from\s+['"][^'"]*['"];?\s*/gs, '')
      // Remove type annotations more carefully (only after : and before = or , or } or ) or ;)
      .replace(/:\s*[\w\[\]<>|&,\s]+(?=\s*[=,})\];])/g, '')
      // Preserve line breaks but clean up extra whitespace
      .replace(/[ \t]+/g, ' ') // Replace tabs and multiple spaces with single space
      .replace(/\n\s*/g, '\n') // Clean up indentation but keep line breaks
      .trim()

    return jsCode
  }

  private generateCodeHash(code: string, types?: string): string {
    const content = code + (types || '')
    return createHash('sha256').update(content).digest('hex')
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startExecutionMonitoring(executionId: string, limits: ResourceLimits): ExecutionMonitor {
    const monitor: ExecutionMonitor = {
      executionId,
      status: 'running',
      startTime: new Date(),
      memoryUsage: 0,
      cpuUsage: 0,
      operationCount: 0,
      networkRequests: 0
    }

    this.activeExecutions.set(executionId, monitor)
    return monitor
  }

  private stopExecutionMonitoring(executionId: string): void {
    const monitor = this.activeExecutions.get(executionId)
    if (monitor) {
      monitor.status = 'completed'
      monitor.endTime = new Date()
      this.activeExecutions.delete(executionId)
    }
  }

  private createSandboxEnvironment(context: SandboxExecutionContext, limits: ResourceLimits): SandboxEnvironment {
    return {
      console: this.createRestrictedConsole(),
      database: this.createMockDatabase(),
      currentUser: context.currentUser,
      utils: this.createSandboxUtils(),
      global: undefined,
      process: undefined,
      Buffer: undefined
    }
  }

  private createRestrictedConsole(): any {
    return {
      log: (...args: any[]) => this.logger.log('[Function]', ...args),
      warn: (...args: any[]) => this.logger.warn('[Function]', ...args),
      error: (...args: any[]) => this.logger.error('[Function]', ...args),
      info: (...args: any[]) => this.logger.info('[Function]', ...args),
      debug: (...args: any[]) => this.logger.debug('[Function]', ...args),
      time: (label: string) => this.logger.time(`[Function] ${label}`),
      timeEnd: (label: string) => this.logger.timeEnd(`[Function] ${label}`)
    }
  }

  private createMockDatabase(): any {
    // Mock database for basic testing
    return {
      collection: (name: string) => ({
        find: async (query?: any) => [],
        findOne: async (query?: any) => null,
        create: async (data: any) => ({ id: 'mock-id', ...data }),
        update: async (query: any, updates: any) => 0,
        delete: async (query: any) => 0,
        count: async (query?: any) => 0,
        aggregate: async (pipeline: any[]) => []
      }),
      transaction: async (callback: any) => {
        throw new Error('Transactions not yet implemented in sandbox')
      },
      query: async (sql: string, params?: any[]) => {
        throw new Error('SQL queries not yet implemented in sandbox')
      }
    }
  }

  private createSandboxUtils(): any {
    return {
      generateId: () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hash: (data: string) => createHash('sha256').update(data).digest('hex'),
      encrypt: (data: string, key: string) => {
        throw new Error('Encryption not yet implemented')
      },
      decrypt: (data: string, key: string) => {
        throw new Error('Decryption not yet implemented')
      },
      validateEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      validateUrl: (url: string) => {
        try {
          new URL(url)
          return true
        } catch {
          return false
        }
      },
      parseJson: (json: string) => JSON.parse(json),
      formatDate: (date: Date, format: string) => {
        return date.toISOString()
      }
    }
  }

    private async executeWithTimeout(
    code: string,
    context: any,
    timeout: number,
    executionId: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let isResolved = false

      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          this.terminateExecution(executionId)
          reject(new ResourceLimitExceededError(
            'Execution timeout exceeded',
            'time',
            timeout,
            timeout
          ))
        }
      }, timeout)

            try {
        // Create a simple execution wrapper that properly handles return statements
        // If code contains return or is a statement (not expression), wrap it normally
        let wrappedCode
        if (code.includes('return ') || code.includes('while') || code.includes('for') || code.includes('if') || code.includes('const ') || code.includes('let ') || code.includes('var ')) {
          wrappedCode = `
            (function() {
              try {
                ${code}
              } catch (error) {
                throw error;
              }
            })()
          `
        } else {
          wrappedCode = `
            (function() {
              try {
                return (${code})
              } catch (error) {
                throw error;
              }
            })()
          `
        }

        // Debug: log available context keys
        this.logger.debug('[SimpleFunctionSandbox] Available context keys:', Object.keys(context))

        const script = new vm.Script(wrappedCode)
        const result = script.runInContext(context, {
          timeout: Math.min(timeout - 10, 1000) // Leave some buffer
        })

        this.logger.debug('[SimpleFunctionSandbox] Execution completed successfully')

        if (!isResolved) {
          isResolved = true
          clearTimeout(timer)
          resolve(result)
        }
      } catch (error) {
        this.logger.error('[SimpleFunctionSandbox] Execution error:', error)
        if (!isResolved) {
          isResolved = true
          clearTimeout(timer)
          reject(error)
        }
      }
    })
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

  private async recordExecutionStats(executionId: string, stats: any): Promise<void> {
    const executionStats: ExecutionStats = {
      executionId,
      duration: stats.duration,
      memoryUsage: {
        peak: stats.memoryUsage?.peak || 0,
        average: stats.memoryUsage?.average || 0,
        final: stats.memoryUsage?.final || 0
      },
      cpuUsage: {
        total: 0,
        average: 0
      },
      operations: {
        database: 0,
        network: 0,
        filesystem: 0
      },
      errors: stats.error ? [{
        type: 'runtime' as const,
        message: stats.error,
        timestamp: new Date()
      }] : []
    }

    this.executionStats.set(executionId, executionStats)
  }
}