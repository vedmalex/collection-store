/**
 * Dependency tracking types for computed attributes system
 * Handles complex dependency relationships and invalidation logic
 */

/**
 * Enhanced dependency specification with detailed tracking
 */
export interface AttributeDependencyDetailed {
  id: string
  attributeId: string // ID of the attribute this dependency refers to
  type: 'field' | 'collection' | 'external_api' | 'system' | 'computed_attribute'
  source: string
  targetType?: 'user' | 'document' | 'collection' | 'database'

  // Invalidation behavior
  invalidateOnChange: boolean
  invalidationDelay?: number // milliseconds to delay invalidation
  batchInvalidation?: boolean // whether to batch invalidations

  // Dependency metadata
  description?: string
  priority: 'low' | 'medium' | 'high' | 'critical'

  // Conditional dependencies
  condition?: DependencyCondition

  // Performance hints
  cacheable: boolean
  estimatedComputeTime?: number // milliseconds

  // Monitoring
  lastChecked?: Date
  changeFrequency?: 'never' | 'rare' | 'occasional' | 'frequent' | 'constant'
}

/**
 * Condition for conditional dependencies
 */
export interface DependencyCondition {
  type: 'field_value' | 'user_role' | 'time_range' | 'custom'
  expression: string // JavaScript expression or custom condition
  parameters?: Record<string, any>
}

/**
 * Dependency graph node for tracking relationships
 */
export interface DependencyNode {
  attributeId: string
  dependencies: string[] // IDs of dependencies
  dependents: string[] // IDs of attributes that depend on this one
  depth: number // depth in dependency tree
  circular: boolean // whether this node is part of a circular dependency
}

/**
 * Complete dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>
  edges: DependencyEdge[]
  circularDependencies: string[][] // arrays of attribute IDs in circular dependencies
  maxDepth: number
  lastUpdated: Date
}

/**
 * Edge in dependency graph
 */
export interface DependencyEdge {
  from: string // dependent attribute ID
  to: string // dependency attribute ID
  type: AttributeDependencyDetailed['type']
  weight: number // importance/priority weight
  condition?: DependencyCondition
}

/**
 * Dependency change event
 */
export interface DependencyChangeEvent {
  type: 'added' | 'removed' | 'cleared' | 'field_changed' | 'document_updated' | 'collection_modified' | 'external_data_changed'
  attributeId: string
  dependency?: AttributeDependencyDetailed
  source?: string
  targetType?: 'user' | 'document' | 'collection' | 'database'
  targetId?: string

  // Change details
  changeType?: 'create' | 'update' | 'delete'
  fieldPath?: string
  oldValue?: any
  newValue?: any

  // Metadata
  timestamp: number
  nodeId?: string
  userId?: string

  // Affected attributes
  affectedAttributes: string[]
  invalidationRequired?: boolean
}

/**
 * Dependency validation result
 */
export interface DependencyValidationResult {
  isValid: boolean
  valid: boolean
  errors: string[]
  warnings: string[]
  circularDependencies?: string[][]
  maxDepthExceeded?: boolean
  recommendations?: string[]
  metadata?: {
    dependencyDepth: number
    wouldCreateCycle: boolean
    estimatedImpact: number
  }
}

/**
 * Dependency validation error
 */
export interface DependencyValidationError {
  type: 'circular_dependency' | 'missing_dependency' | 'invalid_source' | 'depth_exceeded'
  message: string
  attributeId: string
  dependencyId?: string
  path?: string[]
}

/**
 * Dependency validation warning
 */
export interface DependencyValidationWarning {
  type: 'performance_concern' | 'frequent_invalidation' | 'deep_nesting' | 'external_dependency'
  message: string
  attributeId: string
  severity: 'low' | 'medium' | 'high'
  recommendation?: string
}

/**
 * Dependency tracking configuration
 */
export interface DependencyTrackingConfig {
  maxDepth: number
  allowCircularDependencies: boolean
  batchInvalidationDelay: number // milliseconds
  maxBatchSize: number

  // Performance settings
  enableChangeTracking: boolean
  changeTrackingInterval: number // milliseconds

  // Validation settings
  validateOnRegister: boolean
  strictValidation: boolean

  // Monitoring
  enableMetrics: boolean
  metricsRetention: number // seconds
}

/**
 * Dependency tracking statistics
 */
export interface DependencyTrackingStats {
  totalDependencies: number
  activeDependencies: number
  circularDependencies: number
  averageDepth: number
  maxDepth: number

  // Performance metrics
  totalInvalidations: number
  batchedInvalidations: number
  averageInvalidationTime: number

  // Change tracking
  totalChanges: number
  changesPerMinute: number
  mostFrequentChanges: Array<{
    source: string
    count: number
    lastChange: Date
  }>

  // Health metrics
  healthScore: number // 0-100
  issues: string[]
  lastValidation: Date
}

/**
 * Dependency resolver interface for complex dependency resolution
 */
export interface IDependencyResolver {
  /**
   * Resolve all dependencies for an attribute
   */
  resolveDependencies(attributeId: string): Promise<ResolvedDependency[]>

  /**
   * Get computation order for multiple attributes
   */
  getComputationOrder(attributeIds: string[]): Promise<string[]>

  /**
   * Check for circular dependencies
   */
  checkCircularDependencies(attributeId: string): Promise<string[][]>

  /**
   * Get all attributes affected by a change
   */
  getAffectedAttributes(changeEvent: DependencyChangeEvent): Promise<string[]>
}

/**
 * Resolved dependency with computed values
 */
export interface ResolvedDependency {
  dependency: AttributeDependencyDetailed
  value: any
  computedAt: Date
  cached: boolean
  computeTime: number
  error?: Error
}
