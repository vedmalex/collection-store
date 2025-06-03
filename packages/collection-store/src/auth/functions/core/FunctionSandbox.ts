// TypeScript Function Sandbox Implementation
// Provides secure compilation and execution of TypeScript code
import { createHash } from 'crypto'
import { performance } from 'perf_hooks'
import * as ts from 'typescript'
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
  SandboxEnvironment,
  RestrictedDatabase,
  RestrictedCollection,
  RestrictedConsole
} from '../interfaces'

import type { CSDatabase } from '../../../CSDatabase'
import type { User } from '../../interfaces/types'
import { ResourceLimitExceededError, FunctionCompilationError } from '../interfaces/types'

/**
 * TypeScript Function Sandbox
 * Provides secure compilation and execution environment for stored functions
 */
export class FunctionSandbox implements IFunctionSandbox {
  private compilationCache = new Map<string, CachedCode>()
  private activeExecutions = new Map<string, ExecutionMonitor>()
  private executionStats = new Map<string, ExecutionStats>()

  constructor(
    private config: SandboxConfig,
    private logger: Console = console
  ) {}

  // ============================================================================
  // Compilation
  // ============================================================================

  async compileTypeScript(code: string, types?: string): Promise<CompilationResult> {
    try {
      this.logger.debug('[FunctionSandbox] Starting TypeScript compilation')

      // Check cache first
      const codeHash = this.generateCodeHash(code, types)
      const cached = await this.getCachedCompiledCode(codeHash)
      if (cached) {
        this.logger.debug('[FunctionSandbox] Using cached compilation result')
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

      // Prepare TypeScript compiler options
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget[this.config.typescript.target],
        module: ts.ModuleKind[this.config.typescript.module],
        strict: this.config.typescript.strict,
        noImplicitAny: this.config.typescript.noImplicitAny,
        strictNullChecks: this.config.typescript.strictNullChecks,
        strictFunctionTypes: this.config.typescript.strictFunctionTypes,
        noImplicitReturns: this.config.typescript.noImplicitReturns,
        noUnusedLocals: this.config.typescript.noUnusedLocals,
        noUnusedParameters: this.config.typescript.noUnusedParameters,
        exactOptionalPropertyTypes: this.config.typescript.exactOptionalPropertyTypes,
        lib: this.config.typescript.lib.map(lib => `lib.${lib.toLowerCase()}.d.ts`),
        types: this.config.typescript.types,
        sourceMap: true,
        inlineSourceMap: false,
        declaration: false,
        removeComments: false,
        preserveConstEnums: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }

      // Create virtual file system
      const fileName = 'function.ts'
      const sourceFile = ts.createSourceFile(
        fileName,
        code,
        compilerOptions.target || ts.ScriptTarget.ES2020,
        true
      )

      // Create program
      const program = ts.createProgram([fileName], compilerOptions, {
        getSourceFile: (name) => name === fileName ? sourceFile : undefined,
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: (name) => name === fileName,
        readFile: (name) => name === fileName ? code : undefined,
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n'
      })

      // Get diagnostics
      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors: any[] = []
      const warnings: any[] = []

      diagnostics.forEach(diagnostic => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        const file = diagnostic.file
        const position = file && diagnostic.start !== undefined
          ? file.getLineAndCharacterOfPosition(diagnostic.start)
          : { line: 0, character: 0 }

        const error = {
          message,
          line: position.line + 1,
          column: position.character + 1,
          code: `TS${diagnostic.code}`
        }

        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          errors.push(error)
        } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
          warnings.push(error)
        }
      })

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          warnings
        }
      }

      // Emit JavaScript
      let compiledCode = ''
      let sourceMap = ''

      const emitResult = program.emit(sourceFile, (fileName, data) => {
        if (fileName.endsWith('.js')) {
          compiledCode = data
        } else if (fileName.endsWith('.js.map')) {
          sourceMap = data
        }
      })

      if (emitResult.emitSkipped) {
        return {
          success: false,
          errors: [{ message: 'TypeScript compilation failed', line: 0, column: 0 }]
        }
      }

      // Cache the result
      await this.cacheCompiledCode(codeHash, compiledCode, sourceMap)

      this.logger.debug('[FunctionSandbox] TypeScript compilation successful')

      return {
        success: true,
        compiledCode,
        sourceMap,
        warnings
      }
    } catch (error) {
      this.logger.error('[FunctionSandbox] Compilation error:', error)
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
    const compilation = await this.compileTypeScript(code, types)

    return {
      valid: compilation.success,
      errors: compilation.errors || [],
      warnings: compilation.warnings || [],
      typeInfo: [] // TODO: Extract type information from AST
    }
  }

  async getDiagnostics(code: string): Promise<TypeScriptDiagnostic[]> {
    // Create source file for analysis
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.ES2020,
      true
    )

    const diagnostics: TypeScriptDiagnostic[] = []

    // Basic syntax check
    const syntaxDiagnostics = sourceFile.parseDiagnostics
    syntaxDiagnostics.forEach(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      const position = diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : { line: 0, character: 0 }

      diagnostics.push({
        category: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        code: diagnostic.code,
        message,
        line: position.line + 1,
        column: position.character + 1
      })
    })

    return diagnostics
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
      this.logger.debug(`[FunctionSandbox] Starting execution ${executionId}`)

      // Start monitoring
      const monitor = this.startExecutionMonitoring(executionId, limits)

      // Create sandbox environment
      const sandbox = this.createSandboxEnvironment(context, limits)

      // Prepare execution context
      const vmContext = vm.createContext({
        ...sandbox,
        parameters,
        exports: {},
        module: { exports: {} },
        require: this.createRestrictedRequire(limits.allowedModules)
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
      this.logger.debug(`[FunctionSandbox] Execution ${executionId} completed in ${executionTime}ms`)

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
      this.logger.error(`[FunctionSandbox] Execution ${executionId} failed after ${executionTime}ms:`, error)

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
      networkAccess: this.config.security.allowGlobalAccess,
      fileSystemAccess: false,
      memoryMonitor: this.createMemoryMonitor(),
      timeoutMonitor: this.createTimeoutMonitor(),
      operationCounter: this.createOperationCounter()
    }

    return this.executeInSandbox(compilation.compiledCode!, parameters, sandboxContext, limits)
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
      this.logger.warn(`[FunctionSandbox] Execution ${executionId} terminated`)
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
    this.logger.info('[FunctionSandbox] Compilation cache cleared')
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

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
      database: this.createRestrictedDatabase(context.database, context.currentUser),
      currentUser: context.currentUser,
      utils: this.createSandboxUtils(),
      global: undefined,
      process: undefined,
      Buffer: undefined
    }
  }

  private createRestrictedConsole(): RestrictedConsole {
    return {
      log: (...args) => this.logger.log('[Function]', ...args),
      warn: (...args) => this.logger.warn('[Function]', ...args),
      error: (...args) => this.logger.error('[Function]', ...args),
      info: (...args) => this.logger.info('[Function]', ...args),
      debug: (...args) => this.logger.debug('[Function]', ...args),
      time: (label) => this.logger.time(`[Function] ${label}`),
      timeEnd: (label) => this.logger.timeEnd(`[Function] ${label}`)
    }
  }

  private createRestrictedDatabase(database: CSDatabase, user: any): RestrictedDatabase {
    return {
      collection: <T = any>(name: string): RestrictedCollection<T> => {
        const collection = database.collection<T>(name)
        return {
          find: (query?: any) => collection.find(query),
          findOne: (query?: any) => collection.findOne(query),
          create: (data: Partial<T>) => collection.create(data),
          update: (query: any, updates: Partial<T>) => collection.update(query, updates),
          delete: (query: any) => collection.delete(query),
          count: (query?: any) => collection.count(query),
          aggregate: (pipeline: any[]) => collection.aggregate(pipeline)
        }
      },
      transaction: async <T>(callback: any) => {
        // TODO: Implement transaction support
        throw new Error('Transactions not yet implemented in sandbox')
      },
      query: async <T = any>(sql: string, params?: any[]) => {
        // TODO: Implement SQL query support
        throw new Error('SQL queries not yet implemented in sandbox')
      }
    }
  }

  private createSandboxUtils(): any {
    return {
      generateId: () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hash: (data: string) => createHash('sha256').update(data).digest('hex'),
      encrypt: (data: string, key: string) => {
        // TODO: Implement encryption
        throw new Error('Encryption not yet implemented')
      },
      decrypt: (data: string, key: string) => {
        // TODO: Implement decryption
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
        // Simple date formatting
        return date.toISOString()
      }
    }
  }

  private createRestrictedRequire(allowedModules: string[]): any {
    return (moduleName: string) => {
      if (!this.isModuleAllowed(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed`)
      }

      // TODO: Implement safe module loading
      throw new Error(`Module loading not yet implemented: ${moduleName}`)
    }
  }

  private async executeWithTimeout(
    code: string,
    context: any,
    timeout: number,
    executionId: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.terminateExecution(executionId)
        reject(new ResourceLimitExceededError(
          'Execution timeout exceeded',
          'time',
          timeout,
          timeout
        ))
      }, timeout)

      try {
        const script = new vm.Script(code)
        const result = script.runInContext(context, { timeout })

        clearTimeout(timer)

        // Handle different return types
        if (typeof result === 'function') {
          // If the result is a function, call it with parameters
          const functionResult = result(context.parameters)
          resolve(functionResult)
        } else {
          resolve(result)
        }
      } catch (error) {
        clearTimeout(timer)
        reject(error)
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