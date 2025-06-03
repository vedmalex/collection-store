// Stored Functions & Procedures System - Main Exports
// Phase 1.6 Implementation

// Core interfaces and types
export * from './interfaces'

// Core implementations
export * from './core'

// TypeScript transpilers
export * from './transpilers'

// TODO: Add additional modules as they are implemented
// export * from './deployment'
// export * from './views'
// export * from './procedures'
// export * from './utils'

// Convenience re-exports for common usage
export type {
  // Main interfaces
  IStoredFunctionEngine,
  IFunctionSandbox,

  // Core types
  StoredFunctionDefinition,
  FunctionExecutionContext,
  FunctionResult,
  FunctionSecurity,
  ResourceLimits,

  // Configuration
  SandboxConfig,

  // Results
  CompilationResult,
  ExecutionStats,
  SecurityValidationResult
} from './interfaces'

export {
  // Main implementations
  SimpleFunctionSandbox
} from './core'

// Default configurations
export const DEFAULT_SANDBOX_CONFIG: Partial<any> = {
  typescript: {
    target: 'ES2020',
    module: 'CommonJS',
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    noImplicitReturns: true,
    noUnusedLocals: false, // Allow unused locals in functions
    noUnusedParameters: false, // Allow unused parameters in functions
    exactOptionalPropertyTypes: true,
    lib: ['ES2020', 'DOM'],
    types: []
  },
  limits: {
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxDbOperations: 1000,
    maxNetworkRequests: 10,
    allowedModules: ['lodash', 'date-fns', 'crypto']
  },
  security: {
    allowEval: false,
    allowFunction: false,
    allowAsyncFunction: true,
    allowGenerators: false,
    allowProxyTraps: false,
    allowPrototypeAccess: false,
    allowGlobalAccess: false,
    blockedGlobals: ['process', 'global', 'Buffer', 'require'],
    blockedProperties: ['__proto__', 'constructor', 'prototype']
  },
  modules: {
    allowedModules: ['lodash', 'date-fns', 'crypto'],
    blockedModules: ['fs', 'path', 'os', 'child_process', 'cluster'],
    allowNodeModules: false,
    allowRelativeImports: false,
    allowAbsoluteImports: false
  },
  monitoring: {
    enabled: true,
    sampleRate: 1.0,
    collectMemoryStats: true,
    collectCpuStats: true,
    collectNetworkStats: true,
    maxExecutionTime: 30000,
    memoryThreshold: 50 * 1024 * 1024,
    cpuThreshold: 80
  }
}

export const DEFAULT_RESOURCE_LIMITS: any = {
  maxExecutionTime: 30000, // 30 seconds
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  maxDbOperations: 1000,
  maxNetworkRequests: 10,
  allowedModules: ['lodash', 'date-fns', 'crypto']
}