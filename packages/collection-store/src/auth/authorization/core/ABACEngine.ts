import type { CSDatabase } from '../../../CSDatabase'
import type { User } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  ABACConfig
} from '../interfaces'
import { ComputedAttributeEngine } from '../../computed/core/ComputedAttributeEngine'
import { AuthorizationAttributes } from '../../computed/schema/AuthorizationAttributes'
import { AuditLogger } from '../../core/AuditLogger'

/**
 * ABAC Engine - Attribute-Based Access Control
 * Integrates with existing ComputedAttributeEngine from Phase 1.5
 */
export class ABACEngine {
  private computedAttributeEngine: ComputedAttributeEngine
  private auditLogger: AuditLogger
  private initialized = false

    constructor(
    private database: CSDatabase,
    private config: ABACConfig
  ) {
    this.computedAttributeEngine = new ComputedAttributeEngine({
      enableCaching: true,
      defaultCacheTTL: 300000, // 5 minutes
      maxConcurrentComputations: 50
    })
    this.auditLogger = new AuditLogger(database)
  }

      /**
   * Initialize built-in authorization attributes
   */
  private async initializeAuthorizationAttributes(): Promise<void> {
    if (this.initialized) {
      return
    }

        try {
      // Initialize the ComputedAttributeEngine first (only if not already initialized)
      try {
        await this.computedAttributeEngine.initialize()
      } catch (error) {
        // Ignore "already initialized" error
        if (error instanceof Error && !error.message.includes('already initialized')) {
          throw error
        }
      }

      const authAttributes = AuthorizationAttributes.getAuthorizationAttributes()

      for (const attribute of authAttributes) {
        try {
          await this.computedAttributeEngine.registerAttribute(attribute)
        } catch (error) {
          // Ignore "already exists" error
          if (error instanceof Error && !error.message.includes('already exists')) {
            throw error
          }
        }
      }

      this.initialized = true
    } catch (error) {
      console.warn('Failed to initialize authorization attributes:', error)
    }
  }

  /**
   * Check ABAC permissions for user based on computed attributes
   */
  async checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<AuthorizationResult> {
    const startTime = Date.now()

    try {
      // Initialize authorization attributes if not done yet
      await this.initializeAuthorizationAttributes()

      // If ABAC is disabled, allow by default
      if (!this.config.enabled) {
        return {
          allowed: true,
          reason: 'ABAC disabled',
          appliedRules: ['abac:disabled'],
          cacheHit: false,
          evaluationTime: Date.now() - startTime
        }
      }

      // Evaluate ABAC attributes
      const hasPermission = await this.evaluateABACPermission(
        user,
        resource,
        action,
        context
      )

      const result: AuthorizationResult = {
        allowed: hasPermission.allowed,
        reason: hasPermission.reason,
        appliedRules: hasPermission.appliedRules,
        cacheHit: false,
        evaluationTime: Date.now() - startTime,
        metadata: {
          engine: 'abac',
          evaluatedAttributes: hasPermission.evaluatedAttributes,
          contextAttributes: this.config.contextAttributes
        }
      }

      // Audit log
      await this.auditLogger.logAuthorization(
        user.id,
        this.resourceToString(resource),
        action,
        result.allowed ? 'success' : 'denied',
        context.context,
        {
          reason: result.reason,
          appliedRules: result.appliedRules,
          evaluatedAttributes: hasPermission.evaluatedAttributes,
          evaluationTime: result.evaluationTime
        }
      )

      return result
    } catch (error) {
      const errorResult: AuthorizationResult = {
        allowed: this.config.defaultDeny ? false : true,
        reason: `ABAC evaluation error: ${error.message}`,
        appliedRules: ['abac:error'],
        cacheHit: false,
        evaluationTime: Date.now() - startTime
      }

      await this.auditLogger.logSecurity(
        user.id,
        'abac_permission_error',
        'high',
        context.context,
        { error: error.message, action, resource: this.resourceToString(resource) }
      )

      return errorResult
    }
  }

  /**
   * Evaluate ABAC permission using computed attributes
   */
  private async evaluateABACPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<{
    allowed: boolean
    reason: string
    appliedRules: string[]
    evaluatedAttributes: Record<string, any>
  }> {
    const appliedRules: string[] = []
    const evaluatedAttributes: Record<string, any> = {}

    // Get user's computed attributes for authorization
    const userAttributes = await this.computedAttributeEngine.computeAllAttributes(
      'user',
      user.id,
      {
        target: user,
        targetId: user.id,
        targetType: 'user',
        database: this.database,
        timestamp: context.timestamp,
        nodeId: context.nodeId || 'unknown',
        currentUser: user,
        authContext: context.context
      }
    )

    evaluatedAttributes.userAttributes = userAttributes
    appliedRules.push('abac:user_attributes')

    // Check authorization-specific attributes
    const authorizationAttributes = await this.evaluateAuthorizationAttributes(
      user,
      resource,
      action,
      context,
      userAttributes
    )

    evaluatedAttributes.authorizationAttributes = authorizationAttributes
    appliedRules.push('abac:authorization_attributes')

    // Apply ABAC rules based on attributes
    const attributeBasedDecision = this.applyAttributeBasedRules(
      userAttributes,
      authorizationAttributes,
      resource,
      action,
      context
    )

    appliedRules.push(...attributeBasedDecision.appliedRules)

    return {
      allowed: attributeBasedDecision.allowed,
      reason: attributeBasedDecision.reason,
      appliedRules,
      evaluatedAttributes
    }
  }

  /**
   * Evaluate authorization-specific computed attributes
   */
  private async evaluateAuthorizationAttributes(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext,
    userAttributes: Record<string, any>
  ): Promise<Record<string, any>> {
    const authAttributes: Record<string, any> = {}

    try {
      // User access level (built-in attribute from Phase 1.5)
      if (userAttributes['user-access-level']) {
        authAttributes.accessLevel = userAttributes['user-access-level']
      }

      // User last activity (built-in attribute from Phase 1.5)
      if (userAttributes['user-last-activity']) {
        authAttributes.lastActivity = userAttributes['user-last-activity']
      }

      // Time-based attributes
      authAttributes.currentTime = {
        hour: new Date(context.timestamp).getHours(),
        dayOfWeek: new Date(context.timestamp).getDay(),
        isBusinessHours: this.isBusinessHours(context.timestamp)
      }

      // Context-based attributes
      authAttributes.requestContext = {
        ipAddress: context.context.ip,
        region: context.context.region,
        userAgent: context.context.userAgent
      }

      // Resource-based attributes
      if (resource.type === 'document' && resource.collection && resource.documentId) {
        const documentAttributes = await this.computedAttributeEngine.computeAllAttributes(
          'document',
          resource.documentId,
          {
            target: { id: resource.documentId, collection: resource.collection },
            targetId: resource.documentId,
            targetType: 'document',
            database: this.database,
            currentCollection: this.database.collection(resource.collection),
            timestamp: context.timestamp,
            nodeId: context.nodeId || 'unknown',
            currentUser: user,
            authContext: context.context
          }
        )

        authAttributes.documentAttributes = documentAttributes
      }

      return authAttributes
    } catch (error) {
      console.warn('Error evaluating authorization attributes:', error)
      return authAttributes
    }
  }

  /**
   * Apply attribute-based access control rules
   */
  private applyAttributeBasedRules(
    userAttributes: Record<string, any>,
    authAttributes: Record<string, any>,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): {
    allowed: boolean
    reason: string
    appliedRules: string[]
  } {
    const appliedRules: string[] = []

    // Rule 1: Access level based control
    if (authAttributes.accessLevel) {
      const accessLevel = authAttributes.accessLevel

      // High security resources require high access level
      if (this.isHighSecurityResource(resource) && accessLevel !== 'high') {
        appliedRules.push('abac:access_level_insufficient')
        return {
          allowed: false,
          reason: `Access level '${accessLevel}' insufficient for high security resource`,
          appliedRules
        }
      }

      appliedRules.push('abac:access_level_check')
    }

    // Rule 2: Time-based access control
    if (authAttributes.currentTime) {
      const { isBusinessHours } = authAttributes.currentTime

      // Restrict sensitive operations outside business hours
      if (!isBusinessHours && this.isSensitiveAction(action)) {
        appliedRules.push('abac:business_hours_restriction')
        return {
          allowed: false,
          reason: 'Sensitive operations not allowed outside business hours',
          appliedRules
        }
      }

      appliedRules.push('abac:time_based_check')
    }

    // Rule 3: Recent activity check
    if (authAttributes.lastActivity) {
      const { minutesAgo } = authAttributes.lastActivity

      // Require recent activity for sensitive operations
      if (minutesAgo > 30 && this.isSensitiveAction(action)) {
        appliedRules.push('abac:stale_session')
        return {
          allowed: false,
          reason: 'Recent activity required for sensitive operations',
          appliedRules
        }
      }

      appliedRules.push('abac:activity_check')
    }

    // Rule 4: Document ownership check
    if (authAttributes.documentAttributes && authAttributes.documentAttributes['document-ownership']) {
      const ownership = authAttributes.documentAttributes['document-ownership']

      if (ownership.ownerId === context.user.id) {
        appliedRules.push('abac:document_ownership')
        return {
          allowed: true,
          reason: 'Allowed by document ownership',
          appliedRules
        }
      }
    }

    // Rule 5: Context-based restrictions
    if (authAttributes.requestContext) {
      const { region } = authAttributes.requestContext

      // Check if user is allowed in this region
      const allowedRegions = context.user.attributes?.allowedRegions
      if (allowedRegions && region && !allowedRegions.includes(region)) {
        appliedRules.push('abac:region_restriction')
        return {
          allowed: false,
          reason: `Access not allowed from region: ${region}`,
          appliedRules
        }
      }

      appliedRules.push('abac:context_check')
    }

    // Default: allow if no deny rules triggered
    appliedRules.push('abac:default_allow')
    return {
      allowed: !this.config.defaultDeny,
      reason: this.config.defaultDeny ? 'Default deny policy' : 'No ABAC restrictions found',
      appliedRules
    }
  }

  /**
   * Check if resource is high security
   */
  private isHighSecurityResource(resource: ResourceDescriptor): boolean {
    // Define high security patterns
    const highSecurityPatterns = [
      /admin/i,
      /security/i,
      /audit/i,
      /config/i,
      /system/i,
      /sensitive/i
    ]

    const resourceString = this.resourceToString(resource)
    return highSecurityPatterns.some(pattern => pattern.test(resourceString))
  }

  /**
   * Check if action is sensitive
   */
  private isSensitiveAction(action: string): boolean {
    const sensitiveActions = [
      'delete',
      'admin',
      'config',
      'system',
      'bulk_write',
      'drop_database',
      'drop_collection',
      'manage_users',
      'manage_roles'
    ]

    return sensitiveActions.includes(action.toLowerCase())
  }

  /**
   * Check if current time is within business hours
   */
  private isBusinessHours(timestamp: number): boolean {
    const date = new Date(timestamp)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()

    // Monday to Friday, 9 AM to 5 PM
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 17
  }

  /**
   * Convert resource descriptor to string
   */
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

  /**
   * Get ABAC configuration
   */
  getConfig(): ABACConfig {
    return { ...this.config }
  }

  /**
   * Update ABAC configuration
   */
  updateConfig(config: Partial<ABACConfig>): void {
    this.config = { ...this.config, ...config }
  }

    /**
   * Health check for ABAC engine
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if ComputedAttributeEngine exists and configuration is valid
      const engineExists = this.computedAttributeEngine !== null && this.computedAttributeEngine !== undefined
      const configValid = this.config !== null && typeof this.config.enabled === 'boolean'

      return engineExists && configValid
    } catch (error) {
      return false
    }
  }
}