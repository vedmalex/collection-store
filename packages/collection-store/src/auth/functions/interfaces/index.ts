// Stored Functions & Procedures System - Interface Exports
// Phase 1.6 Implementation

// Core types and interfaces
export * from './types'

// Main engine interface
export * from './IStoredFunctionEngine'

// Sandbox interface
export * from './IFunctionSandbox'

// TypeScript transpiler interface
export * from './ITypeScriptTranspiler'

// Re-export commonly used types for convenience
export type {
  // Core function types
  StoredFunctionDefinition,
  FunctionExecutionContext,
  FunctionResult,
  ComputedViewResult,
  ProcedureResult,

  // Security and execution
  FunctionSecurity,
  ResourceLimits,
  TransactionConfig,

  // Deployment and versioning
  DeploymentStrategy,
  DeploymentResult,
  ABTestConfig,
  ABTest,
  ABTestResult,

  // Monitoring and performance
  FunctionStats,
  PerformanceMetrics,

  // Sandbox and compilation
  CompilationResult,
  SandboxExecutionContext,

  // Error types
  FunctionExecutionError,
  FunctionCompilationError,
  ResourceLimitExceededError,
  AuthorizationError,
  ValidationError
} from './types'

export type {
  // Main interfaces
  IStoredFunctionEngine,
  IStoredFunctionEngineFactory,

  // Supporting interfaces
  FunctionFilter,
  CacheStats,
  FunctionCacheStats,
  TimeRange,
  HealthIssue,
  ValidationResult,
  TestCase,
  TestResult,
  FunctionEvent,
  IFunctionEventListener
} from './IStoredFunctionEngine'

export type {
  // Sandbox interfaces
  IFunctionSandbox,
  IFunctionSandboxFactory,

  // Sandbox supporting types
  TypeScriptDiagnostic,
  ExecutionMonitor,
  ExecutionStats,
  ExecutionError,
  SecurityValidationResult,
  SecurityIssue,
  TypeInfo,
  CachedCode,

  // Configuration types
  TypeScriptConfig,
  SandboxSecurityConfig,
  ModuleConfig,
  MonitoringConfig,

  // Environment types
  SandboxEnvironment,
  RestrictedConsole,
  RestrictedDatabase,
  RestrictedCollection,
  RestrictedTransaction,
  RestrictedHttpClient,
  HttpOptions,
  HttpResponse,
  SandboxUtils,
  RestrictedRequire
} from './IFunctionSandbox'