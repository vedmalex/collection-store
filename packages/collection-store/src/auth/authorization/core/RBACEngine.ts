import type { CSDatabase } from '../../../CSDatabase'
import type { User } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  RBACConfig
} from '../interfaces'
import { RoleManager } from '../../core/RoleManager'
import { AuditLogger } from '../../core/AuditLogger'

/**
 * RBAC Engine - Role-Based Access Control
 * Integrates with existing RoleManager from Phase 1
 */
export class RBACEngine {
  private roleManager: RoleManager
  private auditLogger: AuditLogger

  constructor(
    private database: CSDatabase,
    private config: RBACConfig
  ) {
    this.roleManager = new RoleManager(database)
    this.auditLogger = new AuditLogger(database)
  }

  /**
   * Check RBAC permissions for user
   */
  async checkPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<AuthorizationResult> {
    const startTime = Date.now()

    try {
      // If RBAC is disabled, allow by default
      if (!this.config.enabled) {
        return {
          allowed: true,
          reason: 'RBAC disabled',
          appliedRules: ['rbac:disabled'],
          cacheHit: false,
          evaluationTime: Date.now() - startTime
        }
      }

      // Check if user has required roles/permissions
      const hasPermission = await this.evaluateRBACPermission(
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
          engine: 'rbac',
          userRoles: user.roles,
          strictMode: this.config.strictMode
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
          evaluationTime: result.evaluationTime
        }
      )

      return result
    } catch (error) {
      const errorResult: AuthorizationResult = {
        allowed: this.config.defaultDeny ? false : true,
        reason: `RBAC evaluation error: ${error.message}`,
        appliedRules: ['rbac:error'],
        cacheHit: false,
        evaluationTime: Date.now() - startTime
      }

      await this.auditLogger.logSecurity(
        user.id,
        'rbac_permission_error',
        'high',
        context.context,
        { error: error.message, action, resource: this.resourceToString(resource) }
      )

      return errorResult
    }
  }

  /**
   * Evaluate RBAC permission using existing RoleManager
   */
  private async evaluateRBACPermission(
    user: User,
    resource: ResourceDescriptor,
    action: string,
    context: EvaluationContext
  ): Promise<{
    allowed: boolean
    reason: string
    appliedRules: string[]
  }> {
    const appliedRules: string[] = []

    // Check if user has any roles
    if (!user.roles || user.roles.length === 0) {
      return {
        allowed: !this.config.defaultDeny,
        reason: 'User has no roles assigned',
        appliedRules: ['rbac:no_roles']
      }
    }

    // Get user's effective permissions through RoleManager
    // For testing, use the user's roles directly
    const userPermissions = await this.roleManager.getUserPermissionsByRoles(user.roles)
    appliedRules.push('rbac:role_permissions')

    // Check if any permission matches the resource and action
    const resourceString = this.resourceToString(resource)

    for (const permission of userPermissions) {
      // Check if permission matches resource
      if (this.permissionMatches(permission, resourceString, action)) {
        appliedRules.push(`rbac:permission:${permission.resource}:${permission.action}`)

        return {
          allowed: true,
          reason: `Allowed by permission: ${permission.resource}:${permission.action}`,
          appliedRules
        }
      }
    }

    // Check for wildcard permissions
    for (const permission of userPermissions) {
      if (this.wildcardPermissionMatches(permission, resource, action)) {
        appliedRules.push(`rbac:wildcard:${permission.resource}:${permission.action}`)

        return {
          allowed: true,
          reason: `Allowed by wildcard permission: ${permission.resource}:${permission.action}`,
          appliedRules
        }
      }
    }

    // Check for admin roles (if not in strict mode)
    if (!this.config.strictMode) {
      const hasAdminRole = user.roles.some(role =>
        role.includes('admin') || role.includes('super')
      )

      if (hasAdminRole) {
        appliedRules.push('rbac:admin_override')

        return {
          allowed: true,
          reason: 'Allowed by admin role override',
          appliedRules
        }
      }
    }

    // No matching permissions found
    return {
      allowed: !this.config.defaultDeny,
      reason: 'No matching RBAC permissions found',
      appliedRules: appliedRules.length > 0 ? appliedRules : ['rbac:no_match']
    }
  }

  /**
   * Check if permission matches resource and action exactly
   */
  private permissionMatches(
    permission: { resource: string; action: string },
    resourceString: string,
    action: string
  ): boolean {
    return permission.resource === resourceString && permission.action === action
  }

  /**
   * Check if permission matches with wildcards
   */
  private wildcardPermissionMatches(
    permission: { resource: string; action: string },
    resource: ResourceDescriptor,
    action: string
  ): boolean {
    // Action wildcard
    if (permission.action === '*' || permission.action === 'all') {
      if (permission.resource === this.resourceToString(resource)) {
        return true
      }
    }

    // Resource wildcard
    if (permission.resource === '*' || permission.resource === 'all') {
      if (permission.action === action || permission.action === '*') {
        return true
      }
    }

    // Database level wildcard
    if (resource.database && permission.resource === `database:${resource.database}:*`) {
      return permission.action === action || permission.action === '*'
    }

    // Collection level wildcard
    if (resource.collection && permission.resource === `collection:${resource.collection}:*`) {
      return permission.action === action || permission.action === '*'
    }

    return false
  }

  /**
   * Convert resource descriptor to string for permission matching
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
   * Get RBAC configuration
   */
  getConfig(): RBACConfig {
    return { ...this.config }
  }

  /**
   * Update RBAC configuration
   */
  updateConfig(config: Partial<RBACConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Health check for RBAC engine
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if RoleManager is accessible
      await this.roleManager.listRoles({ limit: 1 })
      return true
    } catch (error) {
      return false
    }
  }
}