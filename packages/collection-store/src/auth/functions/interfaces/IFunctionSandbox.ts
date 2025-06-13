// Interface for TypeScript Function Sandbox
// Provides secure execution environment for stored functions
import type {
  CompilationResult,
  SandboxExecutionContext,
  ResourceLimits,
  FunctionExecutionContext,
  TypeScriptError,
  TypeScriptWarning
} from './types'

/**
 * Interface for TypeScript Function Sandbox
 * Provides secure compilation and execution of TypeScript code
 */
export interface IFunctionSandbox {
  // ============================================================================
  // Compilation
  // ============================================================================

  /**
   * Compile TypeScript code to JavaScript
   */
  compileTypeScript(code: string, types?: string): Promise<CompilationResult>

  /**
   * Validate TypeScript code without compilation
   */
  validateTypes(code: string, types?: string): Promise<TypeValidationResult>

  /**
   * Get TypeScript compiler diagnostics
   */
  getDiagnostics(code: string): Promise<TypeScriptDiagnostic[]>

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Execute compiled JavaScript in sandbox
   */
  executeInSandbox(
    compiledCode: string,
    parameters: Record<string, any>,
    context: SandboxExecutionContext,
    limits: ResourceLimits
  ): Promise<any>

  /**
   * Execute TypeScript code (compile + execute)
   */
  executeTypeScript(
    code: string,
    parameters: Record<string, any>,
    context: FunctionExecutionContext,
    limits: ResourceLimits
  ): Promise<any>

  // ============================================================================
  // Monitoring
  // ============================================================================

  /**
   * Monitor execution in real-time
   */
  monitorExecution(executionId: string): Promise<ExecutionMonitor>

  /**
   * Terminate running execution
   */
  terminateExecution(executionId: string): Promise<void>

  /**
   * Get execution statistics
   */
  getExecutionStats(executionId: string): Promise<ExecutionStats>

  // ============================================================================
  // Security
  // ============================================================================

  /**
   * Validate code for security issues
   */
  validateSecurity(code: string): Promise<SecurityValidationResult>

  /**
   * Check if module is allowed
   */
  isModuleAllowed(moduleName: string): boolean

  /**
   * Get sandbox configuration
   */
  getSandboxConfig(): SandboxConfig

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Cache compiled code
   */
  cacheCompiledCode(codeHash: string, compiledCode: string, sourceMap?: string): Promise<void>

  /**
   * Get cached compiled code
   */
  getCachedCompiledCode(codeHash: string): Promise<CachedCode | null>

  /**
   * Clear compilation cache
   */
  clearCompilationCache(): Promise<void>
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface TypeValidationResult {
  valid: boolean
  errors: TypeScriptError[]
  warnings: TypeScriptWarning[]
  typeInfo: TypeInfo[]
}

export interface TypeScriptDiagnostic {
  category: 'error' | 'warning' | 'suggestion' | 'message'
  code: number
  message: string
  file?: string
  line?: number
  column?: number
  length?: number
}

export interface ExecutionMonitor {
  executionId: string
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'terminated'
  startTime: Date
  endTime?: Date
  memoryUsage: number
  cpuUsage: number
  operationCount: number
  networkRequests: number
}

export interface ExecutionStats {
  executionId: string
  duration: number
  memoryUsage: {
    peak: number
    average: number
    final: number
  }
  cpuUsage: {
    total: number
    average: number
  }
  operations: {
    database: number
    network: number
    filesystem: number
  }
  errors: ExecutionError[]
}

export interface ExecutionError {
  type: 'runtime' | 'timeout' | 'memory' | 'security' | 'resource'
  message: string
  stack?: string
  timestamp: Date
}

export interface SecurityValidationResult {
  safe: boolean
  issues: SecurityIssue[]
  recommendations: string[]
}

export interface SecurityIssue {
  type: 'dangerous_function' | 'module_access' | 'eval_usage' | 'prototype_pollution' | 'code_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  line?: number
  column?: number
  suggestion?: string
}

export interface TypeInfo {
  name: string
  type: string
  kind: 'variable' | 'function' | 'class' | 'interface' | 'type'
  location: {
    line: number
    column: number
  }
  documentation?: string
}

export interface CachedCode {
  codeHash: string
  compiledCode: string
  sourceMap?: string
  compiledAt: Date
  accessCount: number
  lastAccessed: Date
}

export interface SandboxConfig {
  // TypeScript compiler options
  typescript: TypeScriptConfig

  // Resource limits
  limits: ResourceLimits

  // Security settings
  security: SandboxSecurityConfig

  // Module access
  modules: ModuleConfig

  // Monitoring
  monitoring: MonitoringConfig
}

export interface TypeScriptConfig {
  target: 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext'
  module: 'CommonJS' | 'ES2020' | 'ESNext'
  strict: boolean
  noImplicitAny: boolean
  strictNullChecks: boolean
  strictFunctionTypes: boolean
  noImplicitReturns: boolean
  noUnusedLocals: boolean
  noUnusedParameters: boolean
  exactOptionalPropertyTypes: boolean
  lib: string[]
  types: string[]
}

export interface SandboxSecurityConfig {
  allowEval: boolean
  allowFunction: boolean
  allowAsyncFunction: boolean
  allowGenerators: boolean
  allowProxyTraps: boolean
  allowPrototypeAccess: boolean
  allowGlobalAccess: boolean
  blockedGlobals: string[]
  blockedProperties: string[]
}

export interface ModuleConfig {
  allowedModules: string[]
  blockedModules: string[]
  allowNodeModules: boolean
  allowRelativeImports: boolean
  allowAbsoluteImports: boolean
  moduleResolver?: (moduleName: string) => string | null
}

export interface MonitoringConfig {
  enabled: boolean
  sampleRate: number // 0-1
  collectMemoryStats: boolean
  collectCpuStats: boolean
  collectNetworkStats: boolean
  maxExecutionTime: number
  memoryThreshold: number
  cpuThreshold: number
}

// ============================================================================
// Sandbox Environment Interfaces
// ============================================================================

export interface SandboxEnvironment {
  // Restricted APIs
  console: RestrictedConsole
  database: RestrictedDatabase
  http?: RestrictedHttpClient

  // User context
  currentUser: {
    id: string
    email: string
    roles: string[]
    permissions: string[]
    attributes: Record<string, any>
  }

  // Utility functions
  utils: SandboxUtils

  // Module access
  require?: RestrictedRequire

  // Global restrictions
  global: undefined
  process: undefined
  Buffer: undefined
}

export interface RestrictedConsole {
  log(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
  info(...args: any[]): void
  debug(...args: any[]): void
  time(label: string): void
  timeEnd(label: string): void
}

export interface RestrictedDatabase {
  collection<T = any>(name: string): RestrictedCollection<T>
  transaction<T>(callback: (tx: RestrictedTransaction) => Promise<T>): Promise<T>
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
}

export interface RestrictedCollection<T = any> {
  find(query?: any): Promise<T[]>
  findOne(query?: any): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(query: any, updates: Partial<T>): Promise<number>
  delete(query: any): Promise<number>
  count(query?: any): Promise<number>
  aggregate(pipeline: any[]): Promise<any[]>
}

export interface RestrictedTransaction {
  collection<T = any>(name: string): RestrictedCollection<T>
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface RestrictedHttpClient {
  get(url: string, options?: HttpOptions): Promise<HttpResponse>
  post(url: string, data?: any, options?: HttpOptions): Promise<HttpResponse>
  put(url: string, data?: any, options?: HttpOptions): Promise<HttpResponse>
  delete(url: string, options?: HttpOptions): Promise<HttpResponse>
}

export interface HttpOptions {
  headers?: Record<string, string>
  timeout?: number
  maxRedirects?: number
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
}

export interface SandboxUtils {
  generateId(): string
  hash(data: string): string
  encrypt(data: string, key: string): string
  decrypt(data: string, key: string): string
  validateEmail(email: string): boolean
  validateUrl(url: string): boolean
  parseJson(json: string): any
  formatDate(date: Date, format: string): string
}

export interface RestrictedRequire {
  (moduleName: string): any
  resolve(moduleName: string): string
  cache: Record<string, any>
}

// ============================================================================
// Factory Interface
// ============================================================================

export interface IFunctionSandboxFactory {
  create(config: SandboxConfig): Promise<IFunctionSandbox>
  createWithDefaults(): Promise<IFunctionSandbox>
}