import type { CSDatabase } from '../../../CSDatabase'
import type { User, AuthContext } from '../../interfaces/types'
import type {
  IAuthorizationEngine,
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  AuthorizationConfig,
  DynamicRule,
  AuthorizationHealthStatus,
  CacheStats
} from '../interfaces'

import { RBACEngine } from './RBACEngine'
import { ABACEngine } from './ABACEngine'
import { PolicyEvaluator } from './PolicyEvaluator'
import { AuditLogger } from '../../core/AuditLogger'

/**
 * Main Authorization Engine - Hybrid RBAC + ABAC
 * Combines role-based and attribute-based access control
 */
export class AuthorizationEngine implements IAuthorizationEngine {
  private rbacEngine: RBACEngine
  private abacEngine: ABACEngine
  private policyEvaluator: PolicyEvaluator
  private auditLogger: AuditLogger
  private permissionCache: Map<string, { result: AuthorizationResult; expiresAt: number }> = new Map()
  private dynamicRules: Map<string, DynamicRule> = new Map()

  // Performance metrics
  private metrics = {
    totalChecks: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    errorCount: 0
  }

  constructor(
    private database: CSDatabase,
    private config: AuthorizationConfig
  ) {
    // Initialize engines
    this.rbacEngine = new RBACEngine(database, config.rbac)
    this.abacEngine = new ABACEngine(database, config.abac)
    this.policyEvaluator = new PolicyEvaluator(config.policies)
    this.auditLogger = new AuditLogger(database)

    // Setup cache cleanup
    if (config.cache.enabled) {
      setInterval(() => {
        this.cleanupExpiredCache()
      }, config.cache.cleanupInterval * 1000)
    }
  }

  /**
   * Main permission check method - combines RBAC + ABAC + Dynamic Rules
   */
  async checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): Promise<AuthorizationResult> {
    const startTime = performance.now()
    this.metrics.totalChecks++

    try {
      // Build evaluation context
      const evaluationContext: EvaluationContext = {
        user,
        resource,
        action,
        context: context || {
          ip: 'unknown',
          userAgent: 'unknown',
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        nodeId: 'main'
      }

      // Check cache first
      if (this.config.cache.enabled) {
        const cacheKey = this.generateCacheKey(user.id, resource, action, context)
        const cached = this.permissionCache.get(cacheKey)

        if (cached && cached.expiresAt > Date.now()) {
          this.metrics.cacheHits++

          const result = {
            ...cached.result,
            cacheHit: true,
            evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
          }

          await this.auditLogger.logAuthorization(
            user.id,
            this.resourceToString(resource),
            action,
            result.allowed ? 'success' : 'denied',
            evaluationContext.context,
            { fromCache: true, reason: result.reason }
          )

          return result
        }

        this.metrics.cacheMisses++
      }

      // Evaluate all authorization engines
      const results = await this.evaluateAllEngines(user, resource, action, evaluationContext)

      // Combine results using policy evaluator
      const finalResult = this.policyEvaluator.combineResults(results, evaluationContext)

      // Add evaluation metadata
      finalResult.cacheHit = false
      // Only set evaluationTime if not already set by PolicyEvaluator
      if (finalResult.evaluationTime === undefined || finalResult.evaluationTime === 0) {
        finalResult.evaluationTime = Math.max(1, Math.round(performance.now() - startTime))
      }

      // Update metrics
      this.updateMetrics(finalResult.evaluationTime!)

      // Cache result
      if (this.config.cache.enabled) {
        const cacheKey = this.generateCacheKey(user.id, resource, action, context)
        this.permissionCache.set(cacheKey, {
          result: finalResult,
          expiresAt: Date.now() + (this.config.cache.ttl * 1000)
        })
      }

      // Audit log
      await this.auditLogger.logAuthorization(
        user.id,
        this.resourceToString(resource),
        action,
        finalResult.allowed ? 'success' : 'denied',
        evaluationContext.context,
        {
          reason: finalResult.reason,
          appliedRules: finalResult.appliedRules,
          evaluationTime: finalResult.evaluationTime,
          engines: results.map(r => r.metadata?.engine || 'unknown')
        }
      )

      return finalResult

    } catch (error) {
      this.metrics.errorCount++

      const errorResult: AuthorizationResult = {
        allowed: false,
        reason: `Authorization error: ${error.message}`,
        appliedRules: ['auth:error'],
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
      }

      await this.auditLogger.logSecurity(
        user.id,
        'authorization_error',
        'high',
        context || { ip: 'unknown', userAgent: 'unknown', timestamp: Date.now() },
        { error: error.message, resource: this.resourceToString(resource), action }
      )

      return errorResult
    }
  }

  /**
   * Batch permission check for multiple resources
   */
  async checkPermissions(
    user: User,
    checks: Array<{ resource: ResourceDescriptor; action: string }>,
    context?: AuthContext
  ): Promise<AuthorizationResult[]> {
    const results: AuthorizationResult[] = []

    // Process checks in parallel for better performance
    const promises = checks.map(check =>
      this.checkPermission(user, check.resource, check.action, context)
    )

    const batchResults = await Promise.all(promises)
    results.push(...batchResults)

    return results
  }

  /**
   * Evaluate all authorization engines
   */
  private async evaluateAllEngines(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<AuthorizationResult[]> {
    const results: AuthorizationResult[] = []

    // 1. RBAC evaluation
    if (this.config.rbac.enabled) {
      const rbacResult = await this.rbacEngine.checkPermission(user, resource, action, context)
      results.push(rbacResult)
    }

    // 2. ABAC evaluation
    if (this.config.abac.enabled) {
      const abacResult = await this.abacEngine.checkPermission(user, resource, action, context)
      results.push(abacResult)
    }

    // 3. Dynamic rules evaluation
    if (this.config.rules.enabled) {
      const rulesResult = await this.evaluateRules(user, resource, action, context)
      results.push(rulesResult)
    }

    // 4. Security policies evaluation
    if (this.config.policies.enabled) {
      const policyResult = this.policyEvaluator.evaluateSecurityPolicies(user, resource, action, context)
      results.push(policyResult)
    }

    return results
  }

  /**
   * Evaluate dynamic rules
   */
  async evaluateRules(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<AuthorizationResult> {
    const startTime = performance.now()
    const appliedRules: string[] = []

    try {
      // Get applicable rules
      const applicableRules = this.getApplicableRules(resource, action)

      if (applicableRules.length === 0) {
        return {
          allowed: true,
          reason: 'No dynamic rules applicable',
          appliedRules: ['rules:none_applicable'],
          cacheHit: false,
          evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
          metadata: { engine: 'dynamic_rules' }
        }
      }

      // Sort by priority (higher first)
      const sortedRules = applicableRules.sort((a, b) => b.priority - a.priority)

      // Evaluate rules
      for (const rule of sortedRules) {
        try {
          const ruleResult = await this.evaluateRule(rule, user, resource, context)
          appliedRules.push(`rule:${rule.id}`)

          // If rule denies, return immediately (deny by default)
          if (rule.type === 'deny' && ruleResult) {
            return {
              allowed: false,
              reason: `Denied by rule: ${rule.name}`,
              appliedRules,
              cacheHit: false,
              evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
              metadata: { engine: 'dynamic_rules', denyingRule: rule.id }
            }
          }

          // If rule allows, continue checking for potential denies
          if (rule.type === 'allow' && ruleResult) {
            appliedRules.push(`rule:${rule.id}:allow`)
          }
        } catch (error) {
          console.warn(`Error evaluating rule ${rule.id}:`, error)
          appliedRules.push(`rule:${rule.id}:error`)
        }
      }

      // No deny rules triggered
      return {
        allowed: true,
        reason: 'No deny rules triggered',
        appliedRules,
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
        metadata: { engine: 'dynamic_rules', rulesEvaluated: sortedRules.length }
      }

    } catch (error) {
      return {
        allowed: false,
        reason: `Dynamic rules evaluation error: ${error.message}`,
        appliedRules: ['rules:error'],
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
        metadata: { engine: 'dynamic_rules', error: error.message }
      }
    }
  }

  /**
   * Add dynamic rule
   */
  async addDynamicRule(rule: DynamicRule): Promise<void> {
    // Validate rule
    this.validateDynamicRule(rule)

    // Store rule
    this.dynamicRules.set(rule.id, rule)

    // Clear cache since rules changed
    await this.clearPermissionCache()
  }

  /**
   * Remove dynamic rule
   */
  async removeDynamicRule(ruleId: string): Promise<void> {
    if (!this.dynamicRules.has(ruleId)) {
      throw new Error(`Dynamic rule not found: ${ruleId}`)
    }

    this.dynamicRules.delete(ruleId)

    // Clear cache since rules changed
    await this.clearPermissionCache()
  }

  /**
   * Clear all dynamic rules
   */
  async clearDynamicRules(): Promise<void> {
    this.dynamicRules.clear()

    // Clear cache since rules changed
    await this.clearPermissionCache()
  }

  /**
   * Clear permission cache
   */
  async clearPermissionCache(userId?: string): Promise<void> {
    if (userId) {
      // Clear cache for specific user
      const keysToDelete: string[] = []
      for (const [key] of this.permissionCache) {
        if (key.startsWith(`${userId}:`)) {
          keysToDelete.push(key)
        }
      }
      for (const key of keysToDelete) {
        this.permissionCache.delete(key)
      }
    } else {
      // Clear all cache
      this.permissionCache.clear()
    }
  }

  /**
   * Get permission cache statistics
   */
  async getPermissionCacheStats(): Promise<CacheStats> {
    return {
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
      evictions: 0, // Not tracked yet
      totalRequests: this.metrics.totalChecks,
      hitRate: this.metrics.cacheHits / this.metrics.totalChecks,
      missRate: this.metrics.cacheMisses / this.metrics.totalChecks,
      size: this.permissionCache.size,
      memoryUsage: this.estimateCacheMemoryUsage()
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidateCachePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern)
    const keysToDelete: string[] = []

    for (const [key] of this.permissionCache) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.permissionCache.delete(key)
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<AuthorizationConfig>): Promise<void> {
    this.config = { ...this.config, ...config }

    // Update engine configurations
    if (config.rbac) {
      this.rbacEngine.updateConfig(config.rbac)
    }
    if (config.abac) {
      this.abacEngine.updateConfig(config.abac)
    }
    if (config.policies) {
      this.policyEvaluator.updateConfig(config.policies)
    }

    // Clear cache if cache config changed
    if (config.cache) {
      await this.clearPermissionCache()
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AuthorizationConfig {
    return { ...this.config }
  }

    /**
   * Health check
   */
  async healthCheck(): Promise<AuthorizationHealthStatus> {
    const rbacHealthy = await this.rbacEngine.healthCheck()
    const abacHealthy = await this.abacEngine.healthCheck()
    const policyHealthy = this.policyEvaluator.healthCheck()

    return {
      healthy: rbacHealthy && abacHealthy && policyHealthy,
      components: {
        rbacEngine: rbacHealthy,
        abacEngine: abacHealthy,
        ruleEngine: true, // Simple check for now
        cache: this.config.cache.enabled
      },
      performance: {
        averageResponseTime: this.metrics.averageResponseTime,
        cacheHitRate: this.metrics.cacheHits / Math.max(this.metrics.totalChecks, 1),
        errorRate: this.metrics.errorCount / Math.max(this.metrics.totalChecks, 1)
      },
      lastCheck: new Date()
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateCacheKey(
    userId: string,
    resource: ResourceDescriptor,
    action: string,
    context?: AuthContext
  ): string {
    const resourceStr = this.resourceToString(resource)
    const contextStr = context ? `${context.ip}:${context.region || 'unknown'}` : 'no-context'
    return `${userId}:${resourceStr}:${action}:${contextStr}`
  }

  private resourceToString(resource: ResourceDescriptor): string {
    switch (resource.type) {
      case 'database':
        return `database:${resource.database}`
      case 'collection':
        return `collection:${resource.collection}`
      case 'document':
        return `document:${resource.collection}:${resource.documentId}`
      case 'field':
        return `field:${resource.collection}:${resource.fieldPath}`
      default:
        return 'unknown'
    }
  }

  private getApplicableRules(resource: ResourceDescriptor, action: string): DynamicRule[] {
    const applicable: DynamicRule[] = []

    for (const rule of this.dynamicRules.values()) {
      if (!rule.isActive) continue

      // Check if rule applies to this resource type
      if (rule.scope.resources.includes(resource.type)) {
        // Check if rule applies to this action
        if (rule.scope.actions.includes(action) || rule.scope.actions.includes('*')) {
          applicable.push(rule)
        }
      }
    }

    return applicable
  }

  private async evaluateRule(
    rule: DynamicRule,
    user: User,
    resource: ResourceDescriptor,
    context: EvaluationContext
  ): Promise<boolean> {
    const timeout = rule.timeout || this.config.rules.maxExecutionTime

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Rule ${rule.id} timed out after ${timeout}ms`))
      }, timeout)

      try {
        const result = rule.evaluator(user, resource, context)

        if (result instanceof Promise) {
          result
            .then(res => {
              clearTimeout(timer)
              resolve(res)
            })
            .catch(err => {
              clearTimeout(timer)
              reject(err)
            })
        } else {
          clearTimeout(timer)
          resolve(result)
        }
      } catch (error) {
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  private validateDynamicRule(rule: DynamicRule): void {
    if (!rule.id || !rule.name || !rule.evaluator) {
      throw new Error('Invalid rule: missing required fields')
    }

    if (!['allow', 'deny'].includes(rule.type)) {
      throw new Error('Invalid rule type: must be "allow" or "deny"')
    }

    if (typeof rule.priority !== 'number') {
      throw new Error('Invalid rule priority: must be a number')
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, cached] of this.permissionCache) {
      if (cached.expiresAt <= now) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.permissionCache.delete(key)
    }
  }

  private updateMetrics(responseTime: number): void {
    // Update average response time using exponential moving average
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime * 0.9 + responseTime * 0.1
  }

  private estimateCacheMemoryUsage(): number {
    // Rough estimation: 1KB per cache entry
    return this.permissionCache.size * 1024
  }
}