// Computed Attributes Types - Centralized Exports
// All types related to computed attributes system

// Core types
export * from './ComputedAttributeTypes'

// Cache types
export * from './CacheTypes'

// Dependency tracking types
export * from './DependencyTypes'

// Error handling types
export * from './ErrorTypes'

// Monitoring types
export * from './MonitoringTypes'

// Re-export commonly used types with aliases to avoid conflicts
export type {
  ComputedAttributeDefinition as CADefinition,
  ComputationContext as CAContext,
  ComputeFunction as CAFunction,
  AttributeDependency as CADependency,
  InvalidationTrigger as CATrigger,
  ComputationResult as CAResult,
  BatchComputationRequest as CABatchRequest,
  BatchComputationResult as CABatchResult
} from './ComputedAttributeTypes'

export type {
  ComputedAttributeCacheStats as CACacheStats,
  CachedAttribute as CACachedValue,
  CacheKey as CACacheKey,
  CacheConfig as CACacheConfig,
  CacheHealthStatus as CACacheHealth
} from './CacheTypes'

export type {
  AttributeDependencyDetailed as CADependencyDetailed,
  DependencyGraph as CADependencyGraph,
  DependencyChangeEvent as CADependencyEvent,
  DependencyValidationResult as CADependencyValidation
} from './DependencyTypes'

export type {
  ComputedAttributeErrorDetailed as CAErrorDetailed,
  ComputedAttributeErrorCodeDetailed as CAErrorCodeDetailed,
  ErrorCategory as CAErrorCategory,
  ErrorSeverity as CAErrorSeverity,
  ErrorHandlingConfig as CAErrorConfig,
  ErrorStatistics as CAErrorStats
} from './ErrorTypes'

export type {
  ComputedAttributeMetrics as CAMetrics,
  PerformanceMonitor as CAPerformanceMonitor,
  HealthCheckResult as CAHealthCheck,
  MonitoringConfig as CAMonitoringConfig
} from './MonitoringTypes'
