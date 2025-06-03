// Collection Store Auth System - Main Export
// Comprehensive authentication and authorization system

// Core auth components
export * from './interfaces'
export * from './core'
export * from './utils'

// Phase 1.5: Computed Attributes System
// Export computed attributes with explicit naming to avoid conflicts
export {
  // Core Interfaces
  IComputedAttributeEngine,
  IComputedAttributeCache,

  // Advanced Interfaces (Day 2)
  IDependencyResolver,
  IErrorHandler,
  IMonitoringService,

  // Core Types
  ComputedAttributeDefinition,
  ComputationContext,
  ComputedAttributeCacheStats,
  CacheConfig,
  CacheHealthStatus,

  // Dependency Types (Day 2)
  AttributeDependencyDetailed,
  DependencyGraph,
  DependencyChangeEvent,
  DependencyValidationResult,

  // Error Types (Day 2)
  ComputedAttributeErrorDetailed,
  ComputedAttributeErrorCodeDetailed,
  ErrorCategory,
  ErrorSeverity,
  ErrorHandlingConfig,
  ErrorStatistics,
  ComputedAttributeErrorFactory,

  // Monitoring Types (Day 2)
  ComputedAttributeMetrics,
  PerformanceMonitor,
  HealthCheckResult,
  MonitoringConfig,

  // Legacy compatibility
  ComputedAttributeError,
  ComputedAttributeErrorCode,

  // Constants
  COMPUTED_ATTRIBUTES_VERSION,
  COMPUTED_ATTRIBUTES_MODULE
} from './computed'

// Re-export computed types with CA prefix to avoid conflicts
export type {
  ComputedAttributeDefinition as CADefinition,
  ComputationContext as CAContext,
  ComputedAttributeCacheStats as CACacheStats,
  AttributeDependencyDetailed as CADependencyDetailed,
  ComputedAttributeErrorDetailed as CAErrorDetailed,
  ComputedAttributeMetrics as CAMetrics
} from './computed'

// Version information
export const AUTH_SYSTEM_VERSION = '1.5.0'
export const AUTH_SYSTEM_PHASE = 'Phase 1.5 - Computed Attributes'
