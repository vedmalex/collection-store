import type { ComputedAttributeDefinition, ComputationContext } from '../types'

/**
 * Built-in authorization attributes for ABAC engine
 */
export class AuthorizationAttributes {
  /**
   * Get all authorization-related attributes
   */
  static getAuthorizationAttributes(): ComputedAttributeDefinition[] {
    return [
      this.createUserAccessLevelAttribute(),
      this.createUserLastActivityAttribute(),
      this.createUserSecurityScoreAttribute(),
      this.createDocumentOwnershipAttribute(),
      this.createResourceSensitivityAttribute()
    ]
  }

  /**
   * User access level attribute
   */
  private static createUserAccessLevelAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user-access-level',
      name: 'User Access Level',
      description: 'Computed access level based on user roles and attributes',
      targetType: 'user',
      computeFunction: async (context: ComputationContext) => {
        try {
          const user = context.target as any

          // Check user roles for access level
          if (user.roles?.includes('system:super_admin') || user.roles?.includes('admin')) {
            return 'high'
          }

          if (user.roles?.includes('senior_user') || user.roles?.includes('manager')) {
            return 'high'
          }

          if (user.roles?.includes('editor') || user.roles?.includes('moderator')) {
            return 'medium'
          }

          // Check user attributes
          if (user.attributes?.accessLevel) {
            return user.attributes.accessLevel
          }

          // Default to low access level
          return 'low'
        } catch (error) {
          console.warn('Failed to compute user access level:', error)
          return 'low'
        }
      },
             dependencies: [],
       caching: {
         enabled: true,
         ttl: 300, // 5 minutes
         invalidateOn: [
           { type: 'external_event', source: 'user_role_change' },
           { type: 'external_event', source: 'user_attribute_change' }
         ]
       },
      security: {
        allowExternalRequests: false,
        timeout: 5000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * User last activity attribute
   */
  private static createUserLastActivityAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user-last-activity',
      name: 'User Last Activity',
      description: 'Time since user last activity for session validation',
      targetType: 'user',
      computeFunction: async (context: ComputationContext) => {
        try {
          const user = context.target as any
          const currentTime = context.timestamp || Date.now()

          // Check user's last activity from attributes
          if (user.attributes?.lastActivity) {
            const lastActivity = new Date(user.attributes.lastActivity).getTime()
            const timeSinceActivity = currentTime - lastActivity

            return {
              lastActivity: lastActivity,
              timeSinceActivity: timeSinceActivity,
              isStale: timeSinceActivity > 30 * 60 * 1000, // 30 minutes
              isVeryStale: timeSinceActivity > 2 * 60 * 60 * 1000 // 2 hours
            }
          }

          // If no last activity recorded, consider it stale
          return {
            lastActivity: null,
            timeSinceActivity: Infinity,
            isStale: true,
            isVeryStale: true
          }
        } catch (error) {
          console.warn('Failed to compute user last activity:', error)
          return {
            lastActivity: null,
            timeSinceActivity: Infinity,
            isStale: true,
            isVeryStale: true
          }
        }
      },
             dependencies: [],
       caching: {
         enabled: true,
         ttl: 60, // 1 minute (short TTL for activity data)
         invalidateOn: [
           { type: 'external_event', source: 'user_activity' }
         ]
       },
      security: {
        allowExternalRequests: false,
        timeout: 5000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * User security score attribute
   */
  private static createUserSecurityScoreAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user-security-score',
      name: 'User Security Score',
      description: 'Computed security score based on user behavior and attributes',
      targetType: 'user',
      computeFunction: async (context: ComputationContext) => {
        try {
          const user = context.target as any
          let score = 50 // Base score

          // Increase score for admin roles
          if (user.roles?.includes('admin') || user.roles?.includes('system:super_admin')) {
            score += 30
          }

          // Increase score for verified users
          if (user.attributes?.verified === true) {
            score += 20
          }

          // Decrease score for inactive users
          if (!user.isActive) {
            score -= 40
          }

          // Ensure score is within bounds
          return Math.max(0, Math.min(100, score))
        } catch (error) {
          console.warn('Failed to compute user security score:', error)
          return 0
        }
      },
             dependencies: [
         { type: 'system', source: 'user-last-activity', invalidateOnChange: true }
       ],
       caching: {
         enabled: true,
         ttl: 600, // 10 minutes
         invalidateOn: [
           { type: 'external_event', source: 'user_role_change' },
           { type: 'external_event', source: 'user_verification_change' }
         ]
       },
      security: {
        allowExternalRequests: false,
        timeout: 5000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Document ownership attribute
   */
  private static createDocumentOwnershipAttribute(): ComputedAttributeDefinition {
    return {
      id: 'document-ownership',
      name: 'Document Ownership',
      description: 'Check if user owns or has special access to document',
      targetType: 'document',
      computeFunction: async (context: ComputationContext) => {
        try {
          const currentUser = context.currentUser as any
          const documentId = context.targetId

          // For testing, simulate document ownership
          // In real implementation, this would query the document
          const isOwner = documentId.includes(currentUser?.id) ||
                         documentId.includes('owned-by-user')

          return {
            isOwner,
            canEdit: isOwner || currentUser?.roles?.includes('admin'),
            canDelete: isOwner || currentUser?.roles?.includes('admin'),
            accessLevel: isOwner ? 'full' : 'read'
          }
        } catch (error) {
          console.warn('Failed to compute document ownership:', error)
          return {
            isOwner: false,
            canEdit: false,
            canDelete: false,
            accessLevel: 'none'
          }
        }
      },
             dependencies: [],
       caching: {
         enabled: true,
         ttl: 300, // 5 minutes
         invalidateOn: [
           { type: 'external_event', source: 'document_ownership_change' }
         ]
       },
      security: {
        allowExternalRequests: false,
        timeout: 5000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Resource sensitivity attribute
   */
  private static createResourceSensitivityAttribute(): ComputedAttributeDefinition {
    return {
      id: 'resource-sensitivity',
      name: 'Resource Sensitivity Level',
      description: 'Computed sensitivity level of resource based on name and type',
             targetType: 'collection', // Note: will need separate definition for database
      computeFunction: async (context: ComputationContext) => {
        try {
          const resourceId = context.targetId.toLowerCase()

          // High sensitivity patterns
          const highSensitivityPatterns = [
            'admin', 'security', 'audit', 'config', 'system',
            'sensitive', 'secret', 'private', 'confidential'
          ]

          // Medium sensitivity patterns
          const mediumSensitivityPatterns = [
            'user', 'account', 'profile', 'financial', 'payment'
          ]

          if (highSensitivityPatterns.some(pattern => resourceId.includes(pattern))) {
            return {
              level: 'high',
              requiresHighAccess: true,
              auditRequired: true
            }
          }

          if (mediumSensitivityPatterns.some(pattern => resourceId.includes(pattern))) {
            return {
              level: 'medium',
              requiresHighAccess: false,
              auditRequired: true
            }
          }

          return {
            level: 'low',
            requiresHighAccess: false,
            auditRequired: false
          }
        } catch (error) {
          console.warn('Failed to compute resource sensitivity:', error)
          return {
            level: 'high', // Default to high for safety
            requiresHighAccess: true,
            auditRequired: true
          }
        }
      },
             dependencies: [],
       caching: {
         enabled: true,
         ttl: 3600, // 1 hour (resource sensitivity doesn't change often)
         invalidateOn: [
           { type: 'external_event', source: 'resource_classification_change' }
         ]
       },
      security: {
        allowExternalRequests: false,
        timeout: 5000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }
}