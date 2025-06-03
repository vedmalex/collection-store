import type { User } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  SecurityPoliciesConfig
} from '../interfaces'

/**
 * PolicyEvaluator - Combines RBAC and ABAC results
 * Implements "deny by default" principle
 */
export class PolicyEvaluator {
  constructor(private config: SecurityPoliciesConfig) {}

  /**
   * Combine multiple authorization results using deny-by-default policy
   */
  combineResults(
    results: AuthorizationResult[],
    context: EvaluationContext
  ): AuthorizationResult {
    const startTime = performance.now()

    if (!this.config.enabled) {
      // If policies are disabled, use simple allow-all
      return {
        allowed: true,
        reason: 'Security policies disabled',
        appliedRules: ['policy:disabled'],
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
      }
    }

    // Apply evaluation order if specified
    const orderedResults = this.applyEvaluationOrder(results)

    // Deny by default: any deny result overrides allows
    const denyResult = orderedResults.find(result => !result.allowed)
    if (denyResult) {
      return {
        allowed: false,
        reason: `Denied by policy: ${denyResult.reason}`,
        appliedRules: this.combineAppliedRules(orderedResults),
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
        metadata: {
          evaluator: 'policy',
          denyingEngine: this.identifyEngine(denyResult),
          totalEngines: orderedResults.length,
          evaluationOrder: this.config.policyEvaluationOrder
        }
      }
    }

    // All results allow - check if we have any explicit allows
    const allowResults = orderedResults.filter(result => result.allowed)
    if (allowResults.length === 0) {
      // No explicit allows - apply default policy
      return {
        allowed: this.config.defaultPolicy === 'allow',
        reason: `No explicit permissions found - applying default ${this.config.defaultPolicy} policy`,
        appliedRules: ['policy:default', ...this.combineAppliedRules(orderedResults)],
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
        metadata: {
          evaluator: 'policy',
          defaultPolicy: this.config.defaultPolicy,
          totalEngines: orderedResults.length
        }
      }
    }

    // All engines allow
    return {
      allowed: true,
      reason: 'Allowed by combined policy evaluation',
      appliedRules: this.combineAppliedRules(orderedResults),
      cacheHit: false,
      evaluationTime: Math.max(1, Math.round(performance.now() - startTime)),
      metadata: {
        evaluator: 'policy',
        allowingEngines: allowResults.map(r => this.identifyEngine(r)),
        totalEngines: orderedResults.length
      }
    }
  }

  /**
   * Evaluate security policies for specific scenarios
   */
  evaluateSecurityPolicies(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): AuthorizationResult {
    const startTime = performance.now()
    const appliedRules: string[] = []

    // Security Policy 1: Admin override (if enabled)
    if (this.hasAdminOverride(user)) {
      appliedRules.push('policy:admin_override')
      return {
        allowed: true,
        reason: 'Allowed by admin override policy',
        appliedRules,
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
      }
    }

    // Security Policy 2: Emergency access (if enabled)
    if (this.isEmergencyAccess(context)) {
      appliedRules.push('policy:emergency_access')
      return {
        allowed: true,
        reason: 'Allowed by emergency access policy',
        appliedRules,
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
      }
    }

    // Security Policy 3: Maintenance mode (if enabled)
    if (this.isMaintenanceMode(context)) {
      appliedRules.push('policy:maintenance_mode')
      return {
        allowed: false,
        reason: 'Denied by maintenance mode policy',
        appliedRules,
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
      }
    }

    // Security Policy 4: Rate limiting (if enabled)
    if (this.isRateLimited(user, context)) {
      appliedRules.push('policy:rate_limited')
      return {
        allowed: false,
        reason: 'Denied by rate limiting policy',
        appliedRules,
        cacheHit: false,
        evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
      }
    }

    // No security policies triggered
    appliedRules.push('policy:no_restrictions')
    return {
      allowed: true,
      reason: 'No security policy restrictions',
      appliedRules,
      cacheHit: false,
      evaluationTime: Math.max(1, Math.round(performance.now() - startTime))
    }
  }

  /**
   * Apply evaluation order to results
   */
  private applyEvaluationOrder(results: AuthorizationResult[]): AuthorizationResult[] {
    if (!this.config.policyEvaluationOrder || this.config.policyEvaluationOrder.length === 0) {
      return results
    }

    const orderedResults: AuthorizationResult[] = []
    const resultsByEngine = new Map<string, AuthorizationResult>()

    // Group results by engine
    for (const result of results) {
      const engine = this.identifyEngine(result)
      resultsByEngine.set(engine, result)
    }

    // Apply order
    for (const engineName of this.config.policyEvaluationOrder) {
      const result = resultsByEngine.get(engineName)
      if (result) {
        orderedResults.push(result)
        resultsByEngine.delete(engineName)
      }
    }

    // Add any remaining results
    for (const result of resultsByEngine.values()) {
      orderedResults.push(result)
    }

    return orderedResults
  }

  /**
   * Identify which engine produced the result
   */
  private identifyEngine(result: AuthorizationResult): string {
    if (result.metadata?.engine) {
      return result.metadata.engine
    }

    // Try to identify from applied rules
    if (result.appliedRules.some(rule => rule.startsWith('rbac:'))) {
      return 'rbac'
    }
    if (result.appliedRules.some(rule => rule.startsWith('abac:'))) {
      return 'abac'
    }
    if (result.appliedRules.some(rule => rule.startsWith('rule:'))) {
      return 'dynamic_rules'
    }
    if (result.appliedRules.some(rule => rule.startsWith('policy:'))) {
      return 'policy'
    }

    return 'unknown'
  }

  /**
   * Combine applied rules from multiple results
   */
  private combineAppliedRules(results: AuthorizationResult[]): string[] {
    const allRules = new Set<string>()

    for (const result of results) {
      for (const rule of result.appliedRules) {
        allRules.add(rule)
      }
    }

    return Array.from(allRules)
  }

  /**
   * Check if user has admin override privileges
   */
  private hasAdminOverride(user: User): boolean {
    // Check for super admin or system admin roles
    return user.roles.some(role =>
      role === 'system:super_admin' ||
      role === 'system:admin' ||
      role === 'admin' ||
      role.includes('super_admin') ||
      role.includes('admin')
    )
  }

  /**
   * Check if this is emergency access
   */
  private isEmergencyAccess(context: EvaluationContext): boolean {
    // Check for emergency access flag in context
    return context.customData?.emergencyAccess === true ||
           context.context.customAttributes?.emergencyAccess === true
  }

  /**
   * Check if system is in maintenance mode
   */
  private isMaintenanceMode(context: EvaluationContext): boolean {
    // Check for maintenance mode flag in context
    return context.customData?.maintenanceMode === true ||
           context.context.customAttributes?.maintenanceMode === true
  }

  /**
   * Check if user is rate limited
   */
  private isRateLimited(user: User, context: EvaluationContext): boolean {
    // Simple rate limiting check - can be enhanced with actual rate limiting logic
    const rateLimitFlag = context.customData?.rateLimited ||
                         context.context.customAttributes?.rateLimited

    return rateLimitFlag === true
  }

  /**
   * Get current policy configuration
   */
  getConfig(): SecurityPoliciesConfig {
    return { ...this.config }
  }

  /**
   * Update policy configuration
   */
  updateConfig(config: Partial<SecurityPoliciesConfig>): void {
    this.config = { ...this.config, ...config }
  }

    /**
   * Health check for policy evaluator
   */
  healthCheck(): boolean {
    try {
      // Basic configuration validation
      return this.config !== null &&
             typeof this.config.enabled === 'boolean' &&
             typeof this.config.defaultPolicy === 'string'
    } catch (error) {
      return false
    }
  }
}