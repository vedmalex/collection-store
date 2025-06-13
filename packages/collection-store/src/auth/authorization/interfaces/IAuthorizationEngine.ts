import type {
  User,
  AuthContext
} from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  CacheStats
} from './types'

/**
 * Main Authorization Engine Interface
 * Combines RBAC + ABAC for hybrid authorization
 */
export interface IAuthorizationEngine {
  // ============================================================================
  // Permission Checking
  // ============================================================================

  /**
   * Check if user has permission to perform action on resource
   */
  checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): Promise<AuthorizationResult>

  /**
   * Batch permission check for multiple resources
   */
  checkPermissions(
    user: User,
    checks: Array<{
      resource: ResourceDescriptor
      action: string
    }>,
    context?: AuthContext
  ): Promise<AuthorizationResult[]>

  // ============================================================================
  // Rule Management
  // ============================================================================

  /**
   * Add dynamic rule to the system
   */
  addDynamicRule(rule: DynamicRule): Promise<void>

  /**
   * Remove dynamic rule from the system
   */
  removeDynamicRule(ruleId: string): Promise<void>

  /**
   * Evaluate all applicable rules for a user/resource combination
   */
  evaluateRules(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<AuthorizationResult>

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear permission cache for specific user or all users
   */
  clearPermissionCache(userId?: string): Promise<void>

  /**
   * Get permission cache statistics
   */
  getPermissionCacheStats(): Promise<CacheStats>

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCachePattern(pattern: string): Promise<void>

  // ============================================================================
  // Configuration & Management
  // ============================================================================

  /**
   * Update authorization configuration
   */
  updateConfig(config: Partial<AuthorizationConfig>): Promise<void>

  /**
   * Get current authorization configuration
   */
  getConfig(): AuthorizationConfig

  /**
   * Health check for authorization system
   */
  healthCheck(): Promise<AuthorizationHealthStatus>
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface DynamicRule {
  id: string
  name: string
  description: string
  priority: number
  type: 'allow' | 'deny'

  // Rule scope
  scope: {
    resources: ResourceDescriptor['type'][]
    actions: string[]
    conditions?: string[]
  }

  // JavaScript evaluation function
  evaluator: (
    user: User,
    resource: ResourceDescriptor,
    context: EvaluationContext
  ) => Promise<boolean>

  // Metadata
  isBuiltIn: boolean
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt?: Date

  // Performance settings
  timeout?: number // milliseconds
  cacheResult?: boolean
  cacheTTL?: number // seconds
}

export interface AuthorizationConfig {
  rbac: {
    enabled: boolean
    strictMode: boolean
    inheritanceEnabled: boolean
    defaultDeny: boolean
  }
  abac: {
    enabled: boolean
    attributeEngine: string
    contextAttributes: string[]
    defaultDeny: boolean
  }
  cache: {
    enabled: boolean
    ttl: number
    maxSize: number
    strategy: 'lru' | 'lfu' | 'ttl'
    cleanupInterval: number
  }
  rules: {
    enabled: boolean
    sandbox: {
      allowedModules: string[]
      networkAccess: boolean
      fileSystemAccess: boolean
      timeout: number
    }
    maxExecutionTime: number
    maxMemoryUsage: number
  }
  policies: {
    enabled: boolean
    defaultPolicy: 'allow' | 'deny'
    policyEvaluationOrder: string[]
  }
}

export interface AuthorizationHealthStatus {
  healthy: boolean
  components: {
    rbacEngine: boolean
    abacEngine: boolean
    ruleEngine: boolean
    cache: boolean
  }
  performance: {
    averageResponseTime: number
    cacheHitRate: number
    errorRate: number
  }
  lastCheck: Date
}