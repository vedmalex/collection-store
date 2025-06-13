import type { ComputedAttributeDefinition, ComputationContext } from '../types'

/**
 * Built-in computed attributes for common use cases
 */
export class BuiltInAttributes {
  /**
   * Get all built-in user-level attributes
   */
  static getUserLevelAttributes(): ComputedAttributeDefinition[] {
    return [
      this.createUserProfileCompletenessAttribute(),
      this.createUserLastActivityAttribute(),
      this.createUserRoleCountAttribute(),
      this.createUserPermissionSummaryAttribute(),
      this.createUserSecurityScoreAttribute()
    ]
  }

  /**
   * Get all built-in document-level attributes
   */
  static getDocumentLevelAttributes(): ComputedAttributeDefinition[] {
    return [
      this.createDocumentSizeAttribute(),
      this.createDocumentAgeAttribute(),
      this.createDocumentModificationCountAttribute(),
      this.createDocumentValidationStatusAttribute(),
      this.createDocumentRelationshipCountAttribute()
    ]
  }

  /**
   * Get all built-in collection-level attributes
   */
  static getCollectionLevelAttributes(): ComputedAttributeDefinition[] {
    return [
      this.createCollectionDocumentCountAttribute(),
      this.createCollectionSizeAttribute(),
      this.createCollectionGrowthRateAttribute(),
      this.createCollectionHealthScoreAttribute(),
      this.createCollectionIndexEfficiencyAttribute()
    ]
  }

  /**
   * Get all built-in database-level attributes
   */
  static getDatabaseLevelAttributes(): ComputedAttributeDefinition[] {
    return [
      this.createDatabaseSizeAttribute(),
      this.createDatabaseCollectionCountAttribute(),
      this.createDatabasePerformanceScoreAttribute(),
      this.createDatabaseBackupStatusAttribute(),
      this.createDatabaseConnectionCountAttribute()
    ]
  }

  // User-level attributes

  /**
   * User profile completeness percentage
   */
  private static createUserProfileCompletenessAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user_profile_completeness',
      name: 'Profile Completeness',
      description: 'Percentage of completed profile fields',
      targetType: 'user',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const user = context.target
        if (!user) return 0

        const requiredFields = ['name', 'email', 'phone', 'address', 'avatar']
        const completedFields = requiredFields.filter(field =>
          user[field] && user[field].toString().trim() !== ''
        )

        return Math.round((completedFields.length / requiredFields.length) * 100)
      },
      dependencies: [
        { type: 'field', source: 'name', invalidateOnChange: true },
        { type: 'field', source: 'email', invalidateOnChange: true },
        { type: 'field', source: 'phone', invalidateOnChange: true },
        { type: 'field', source: 'address', invalidateOnChange: true },
        { type: 'field', source: 'avatar', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 3600, // 1 hour
        invalidateOn: [
          { type: 'field_change', source: 'name' },
          { type: 'field_change', source: 'email' },
          { type: 'field_change', source: 'phone' },
          { type: 'field_change', source: 'address' },
          { type: 'field_change', source: 'avatar' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 1000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * User last activity timestamp
   */
  private static createUserLastActivityAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user_last_activity',
      name: 'Last Activity',
      description: 'Timestamp of user\'s last activity',
      targetType: 'user',
      computeFunction: async (context: ComputationContext): Promise<Date | null> => {
        const user = context.target
        if (!user) return null

        // Get last activity from various sources
        const activities = [
          user.lastLoginAt,
          user.lastUpdateAt,
          user.lastActionAt
        ].filter(Boolean)

        if (activities.length === 0) return null

        return new Date(Math.max(...activities.map(date => new Date(date).getTime())))
      },
      dependencies: [
        { type: 'field', source: 'lastLoginAt', invalidateOnChange: true },
        { type: 'field', source: 'lastUpdateAt', invalidateOnChange: true },
        { type: 'field', source: 'lastActionAt', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        invalidateOn: [
          { type: 'field_change', source: 'lastLoginAt' },
          { type: 'field_change', source: 'lastUpdateAt' },
          { type: 'field_change', source: 'lastActionAt' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 500,
        maxMemoryUsage: 512 * 1024 // 512KB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * User role count
   */
  private static createUserRoleCountAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user_role_count',
      name: 'Role Count',
      description: 'Number of roles assigned to user',
      targetType: 'user',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const user = context.target
        if (!user || !user.roles) return 0

        return Array.isArray(user.roles) ? user.roles.length : 0
      },
      dependencies: [
        { type: 'field', source: 'roles', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'field_change', source: 'roles' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 500,
        maxMemoryUsage: 256 * 1024 // 256KB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * User permission summary
   */
  private static createUserPermissionSummaryAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user_permission_summary',
      name: 'Permission Summary',
      description: 'Summary of user permissions across all roles',
      targetType: 'user',
      computeFunction: async (context: ComputationContext): Promise<{
        totalPermissions: number
        uniquePermissions: number
        adminLevel: boolean
        categories: string[]
      }> => {
        const user = context.target
        if (!user || !user.roles) {
          return {
            totalPermissions: 0,
            uniquePermissions: 0,
            adminLevel: false,
            categories: []
          }
        }

        // This would typically query role permissions from database
        // For now, return a simplified calculation
        const roles = Array.isArray(user.roles) ? user.roles : []
        const totalPermissions = roles.length * 5 // Simplified
        const uniquePermissions = Math.min(totalPermissions, 20)
        const adminLevel = roles.some((role: any) =>
          typeof role === 'string' ? role.includes('admin') : role.name?.includes('admin')
        )

        return {
          totalPermissions,
          uniquePermissions,
          adminLevel,
          categories: ['read', 'write', 'delete'].slice(0, Math.ceil(uniquePermissions / 7))
        }
      },
      dependencies: [
        { type: 'field', source: 'roles', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 3600, // 1 hour
        invalidateOn: [
          { type: 'field_change', source: 'roles' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 2000,
        maxMemoryUsage: 2 * 1024 * 1024 // 2MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * User security score
   */
  private static createUserSecurityScoreAttribute(): ComputedAttributeDefinition {
    return {
      id: 'user_security_score',
      name: 'Security Score',
      description: 'User security score based on various factors',
      targetType: 'user',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const user = context.target
        if (!user) return 0

        let score = 0

        // Password strength (if available)
        if (user.passwordStrength) {
          score += Math.min(user.passwordStrength * 20, 30)
        }

        // Two-factor authentication
        if (user.twoFactorEnabled) {
          score += 25
        }

        // Recent activity
        const lastActivity = user.lastLoginAt ? new Date(user.lastLoginAt) : null
        if (lastActivity) {
          const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
          if (daysSinceActivity < 7) score += 20
          else if (daysSinceActivity < 30) score += 10
        }

        // Profile completeness
        const requiredFields = ['name', 'email', 'phone']
        const completedFields = requiredFields.filter(field => user[field])
        score += (completedFields.length / requiredFields.length) * 25

        return Math.min(Math.round(score), 100)
      },
      dependencies: [
        { type: 'field', source: 'passwordStrength', invalidateOnChange: true },
        { type: 'field', source: 'twoFactorEnabled', invalidateOnChange: true },
        { type: 'field', source: 'lastLoginAt', invalidateOnChange: true },
        { type: 'field', source: 'name', invalidateOnChange: true },
        { type: 'field', source: 'email', invalidateOnChange: true },
        { type: 'field', source: 'phone', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 7200, // 2 hours
        invalidateOn: [
          { type: 'field_change', source: 'passwordStrength' },
          { type: 'field_change', source: 'twoFactorEnabled' },
          { type: 'field_change', source: 'lastLoginAt' },
          { type: 'field_change', source: 'name' },
          { type: 'field_change', source: 'email' },
          { type: 'field_change', source: 'phone' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 1500,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  // Document-level attributes

  /**
   * Document size in bytes
   */
  private static createDocumentSizeAttribute(): ComputedAttributeDefinition {
    return {
      id: 'document_size',
      name: 'Document Size',
      description: 'Size of document in bytes',
      targetType: 'document',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const document = context.target
        if (!document) return 0

        // Calculate size based on JSON serialization
        const jsonString = JSON.stringify(document)
        return new Blob([jsonString]).size
      },
      dependencies: [],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'document_change', source: 'document' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 1000,
        maxMemoryUsage: 5 * 1024 * 1024 // 5MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Document age in days
   */
  private static createDocumentAgeAttribute(): ComputedAttributeDefinition {
    return {
      id: 'document_age',
      name: 'Document Age',
      description: 'Age of document in days since creation',
      targetType: 'document',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const document = context.target
        if (!document || !document.createdAt) return 0

        const createdAt = new Date(document.createdAt)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - createdAt.getTime())
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      },
      dependencies: [
        { type: 'field', source: 'createdAt', invalidateOnChange: false }
      ],
      caching: {
        enabled: true,
        ttl: 86400, // 24 hours
        invalidateOn: [
          { type: 'time_based', source: '0 0 * * *' } // Daily at midnight
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 500,
        maxMemoryUsage: 256 * 1024 // 256KB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Document modification count
   */
  private static createDocumentModificationCountAttribute(): ComputedAttributeDefinition {
    return {
      id: 'document_modification_count',
      name: 'Modification Count',
      description: 'Number of times document has been modified',
      targetType: 'document',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const document = context.target
        if (!document) return 0

        // This would typically query modification history from database
        // For now, use version field or estimate based on updatedAt vs createdAt
        if (document.version) {
          return typeof document.version === 'number' ? document.version : 1
        }

        if (document.modificationHistory) {
          return Array.isArray(document.modificationHistory) ? document.modificationHistory.length : 0
        }

        // Fallback: if updatedAt differs from createdAt, assume at least 1 modification
        if (document.updatedAt && document.createdAt) {
          return new Date(document.updatedAt).getTime() !== new Date(document.createdAt).getTime() ? 1 : 0
        }

        return 0
      },
      dependencies: [
        { type: 'field', source: 'version', invalidateOnChange: true },
        { type: 'field', source: 'modificationHistory', invalidateOnChange: true },
        { type: 'field', source: 'updatedAt', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'field_change', source: 'version' },
          { type: 'field_change', source: 'modificationHistory' },
          { type: 'field_change', source: 'updatedAt' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 1000,
        maxMemoryUsage: 512 * 1024 // 512KB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Document validation status
   */
  private static createDocumentValidationStatusAttribute(): ComputedAttributeDefinition {
    return {
      id: 'document_validation_status',
      name: 'Validation Status',
      description: 'Document validation status and score',
      targetType: 'document',
      computeFunction: async (context: ComputationContext): Promise<{
        isValid: boolean
        score: number
        errors: string[]
        warnings: string[]
      }> => {
        const document = context.target
        if (!document) {
          return {
            isValid: false,
            score: 0,
            errors: ['Document not found'],
            warnings: []
          }
        }

        const errors: string[] = []
        const warnings: string[] = []
        let score = 100

        // Check required fields
        const requiredFields = ['id', 'createdAt']
        for (const field of requiredFields) {
          if (!document[field]) {
            errors.push(`Missing required field: ${field}`)
            score -= 20
          }
        }

        // Check data types
        if (document.createdAt && isNaN(new Date(document.createdAt).getTime())) {
          errors.push('Invalid createdAt date format')
          score -= 10
        }

        // Check for deprecated fields
        const deprecatedFields = ['oldField', 'legacyData']
        for (const field of deprecatedFields) {
          if (document[field]) {
            warnings.push(`Deprecated field found: ${field}`)
            score -= 5
          }
        }

        return {
          isValid: errors.length === 0,
          score: Math.max(score, 0),
          errors,
          warnings
        }
      },
      dependencies: [],
      caching: {
        enabled: true,
        ttl: 3600, // 1 hour
        invalidateOn: [
          { type: 'document_change', source: 'document' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 2000,
        maxMemoryUsage: 1024 * 1024 // 1MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Document relationship count
   */
  private static createDocumentRelationshipCountAttribute(): ComputedAttributeDefinition {
    return {
      id: 'document_relationship_count',
      name: 'Relationship Count',
      description: 'Number of relationships this document has',
      targetType: 'document',
      computeFunction: async (context: ComputationContext): Promise<{
        incoming: number
        outgoing: number
        total: number
      }> => {
        const document = context.target
        if (!document) {
          return { incoming: 0, outgoing: 0, total: 0 }
        }

        // This would typically query relationship collections
        // For now, count reference fields
        let outgoing = 0
        let incoming = 0

        // Count outgoing references (fields ending with 'Id' or 'Ref')
        for (const [key, value] of Object.entries(document)) {
          if ((key.endsWith('Id') || key.endsWith('Ref')) && value) {
            if (Array.isArray(value)) {
              outgoing += value.length
            } else {
              outgoing += 1
            }
          }
        }

        // Incoming would need to be queried from database
        // For now, use a placeholder calculation
        incoming = Math.floor(outgoing * 0.7) // Estimate

        return {
          incoming,
          outgoing,
          total: incoming + outgoing
        }
      },
      dependencies: [],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'document_change', source: 'document' },
          { type: 'collection_change', source: 'collection' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 3000,
        maxMemoryUsage: 2 * 1024 * 1024 // 2MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  // Collection-level attributes

  /**
   * Collection document count
   */
  private static createCollectionDocumentCountAttribute(): ComputedAttributeDefinition {
    return {
      id: 'collection_document_count',
      name: 'Document Count',
      description: 'Total number of documents in collection',
      targetType: 'collection',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const collection = context.currentCollection
        if (!collection) return 0

        // This would typically use collection.count() method
        // For now, return a placeholder
        return 1000 // Placeholder
      },
             dependencies: [
         { type: 'collection', source: 'collection', invalidateOnChange: true }
       ],
       caching: {
         enabled: true,
         ttl: 300, // 5 minutes
         invalidateOn: [
           { type: 'collection_change', source: 'collection' }
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
   * Collection size in bytes
   */
  private static createCollectionSizeAttribute(): ComputedAttributeDefinition {
    return {
      id: 'collection_size',
      name: 'Collection Size',
      description: 'Total size of collection in bytes',
      targetType: 'collection',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const collection = context.currentCollection
        if (!collection) return 0

        // This would typically query collection statistics
        // For now, return a placeholder calculation
        return 1024 * 1024 * 50 // 50MB placeholder
      },
      dependencies: [
        { type: 'collection', source: 'collection', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'collection_change', source: 'collection' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 10000,
        maxMemoryUsage: 5 * 1024 * 1024 // 5MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Collection growth rate
   */
  private static createCollectionGrowthRateAttribute(): ComputedAttributeDefinition {
    return {
      id: 'collection_growth_rate',
      name: 'Growth Rate',
      description: 'Collection growth rate (documents per day)',
      targetType: 'collection',
      computeFunction: async (context: ComputationContext): Promise<{
        documentsPerDay: number
        trend: 'increasing' | 'decreasing' | 'stable'
        lastWeekGrowth: number
      }> => {
        // This would typically analyze historical data
        // For now, return placeholder data
        return {
          documentsPerDay: 25.5,
          trend: 'increasing',
          lastWeekGrowth: 178
        }
      },
      dependencies: [
        { type: 'collection', source: 'collection', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 3600, // 1 hour
        invalidateOn: [
          { type: 'time_based', source: '0 * * * *' }, // Hourly
          { type: 'collection_change', source: 'collection' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 15000,
        maxMemoryUsage: 10 * 1024 * 1024 // 10MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Collection health score
   */
  private static createCollectionHealthScoreAttribute(): ComputedAttributeDefinition {
    return {
      id: 'collection_health_score',
      name: 'Health Score',
      description: 'Overall health score of the collection',
      targetType: 'collection',
      computeFunction: async (context: ComputationContext): Promise<{
        score: number
        factors: {
          indexEfficiency: number
          queryPerformance: number
          dataConsistency: number
          storageOptimization: number
        }
        recommendations: string[]
      }> => {
        // This would typically analyze various collection metrics
        // For now, return placeholder data
        return {
          score: 85,
          factors: {
            indexEfficiency: 90,
            queryPerformance: 80,
            dataConsistency: 95,
            storageOptimization: 75
          },
          recommendations: [
            'Consider adding index on frequently queried fields',
            'Review storage optimization settings'
          ]
        }
      },
      dependencies: [
        { type: 'collection', source: 'collection', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 7200, // 2 hours
        invalidateOn: [
          { type: 'collection_change', source: 'collection' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 20000,
        maxMemoryUsage: 15 * 1024 * 1024 // 15MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Collection index efficiency
   */
  private static createCollectionIndexEfficiencyAttribute(): ComputedAttributeDefinition {
    return {
      id: 'collection_index_efficiency',
      name: 'Index Efficiency',
      description: 'Efficiency score of collection indexes',
      targetType: 'collection',
      computeFunction: async (context: ComputationContext): Promise<{
        overallScore: number
        indexCount: number
        unusedIndexes: number
        missingIndexes: string[]
        recommendations: string[]
      }> => {
        // This would typically analyze index usage statistics
        // For now, return placeholder data
        return {
          overallScore: 78,
          indexCount: 5,
          unusedIndexes: 1,
          missingIndexes: ['email', 'status'],
          recommendations: [
            'Remove unused index on legacy_field',
            'Add index on email field for faster user lookups',
            'Consider compound index on status + createdAt'
          ]
        }
      },
      dependencies: [
        { type: 'collection', source: 'collection', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 14400, // 4 hours
        invalidateOn: [
          { type: 'collection_change', source: 'collection' }
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 10000,
        maxMemoryUsage: 5 * 1024 * 1024 // 5MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  // Database-level attributes

  /**
   * Database total size
   */
  private static createDatabaseSizeAttribute(): ComputedAttributeDefinition {
    return {
      id: 'database_size',
      name: 'Database Size',
      description: 'Total size of database in bytes',
      targetType: 'database',
      computeFunction: async (context: ComputationContext): Promise<{
        totalSize: number
        dataSize: number
        indexSize: number
        freeSpace: number
      }> => {
        // This would typically query database statistics
        // For now, return placeholder data
        return {
          totalSize: 1024 * 1024 * 1024 * 5, // 5GB
          dataSize: 1024 * 1024 * 1024 * 3.5, // 3.5GB
          indexSize: 1024 * 1024 * 1024 * 1, // 1GB
          freeSpace: 1024 * 1024 * 1024 * 0.5 // 0.5GB
        }
      },
      dependencies: [
        { type: 'system', source: 'database.stats', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 3600, // 1 hour
        invalidateOn: [
          { type: 'time_based', source: '0 * * * *' } // Hourly
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 30000,
        maxMemoryUsage: 10 * 1024 * 1024 // 10MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Database collection count
   */
  private static createDatabaseCollectionCountAttribute(): ComputedAttributeDefinition {
    return {
      id: 'database_collection_count',
      name: 'Collection Count',
      description: 'Total number of collections in database',
      targetType: 'database',
      computeFunction: async (context: ComputationContext): Promise<number> => {
        const database = context.database
        if (!database) return 0

        // This would typically use database.listCollections()
        // For now, return placeholder
        return 25
      },
      dependencies: [
        { type: 'system', source: 'database.collections', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'collection_change', source: '*' }
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
   * Database performance score
   */
  private static createDatabasePerformanceScoreAttribute(): ComputedAttributeDefinition {
    return {
      id: 'database_performance_score',
      name: 'Performance Score',
      description: 'Overall database performance score',
      targetType: 'database',
      computeFunction: async (context: ComputationContext): Promise<{
        overallScore: number
        metrics: {
          queryLatency: number
          throughput: number
          connectionPool: number
          memoryUsage: number
          diskIO: number
        }
        recommendations: string[]
      }> => {
        // This would typically analyze performance metrics
        // For now, return placeholder data
        return {
          overallScore: 82,
          metrics: {
            queryLatency: 85,
            throughput: 90,
            connectionPool: 75,
            memoryUsage: 80,
            diskIO: 78
          },
          recommendations: [
            'Optimize slow queries',
            'Consider increasing connection pool size',
            'Monitor disk I/O patterns'
          ]
        }
      },
      dependencies: [
        { type: 'system', source: 'database.performance', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 900, // 15 minutes
        invalidateOn: [
          { type: 'time_based', source: '*/15 * * * *' } // Every 15 minutes
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 15000,
        maxMemoryUsage: 20 * 1024 * 1024 // 20MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Database backup status
   */
  private static createDatabaseBackupStatusAttribute(): ComputedAttributeDefinition {
    return {
      id: 'database_backup_status',
      name: 'Backup Status',
      description: 'Current backup status and schedule',
      targetType: 'database',
      computeFunction: async (context: ComputationContext): Promise<{
        lastBackup: Date | null
        nextBackup: Date | null
        backupSize: number
        status: 'healthy' | 'warning' | 'critical'
        issues: string[]
      }> => {
        // This would typically query backup system
        // For now, return placeholder data
        const now = new Date()
        const lastBackup = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
        const nextBackup = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

        return {
          lastBackup,
          nextBackup,
          backupSize: 1024 * 1024 * 1024 * 2.5, // 2.5GB
          status: 'healthy',
          issues: []
        }
      },
      dependencies: [
        { type: 'system', source: 'backup.status', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        invalidateOn: [
          { type: 'time_based', source: '*/30 * * * *' } // Every 30 minutes
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 10000,
        maxMemoryUsage: 5 * 1024 * 1024 // 5MB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Database connection count
   */
  private static createDatabaseConnectionCountAttribute(): ComputedAttributeDefinition {
    return {
      id: 'database_connection_count',
      name: 'Connection Count',
      description: 'Current number of active database connections',
      targetType: 'database',
      computeFunction: async (context: ComputationContext): Promise<{
        active: number
        idle: number
        total: number
        maxConnections: number
        utilizationPercentage: number
      }> => {
        // This would typically query connection pool statistics
        // For now, return placeholder data
        const active = 45
        const idle = 15
        const total = active + idle
        const maxConnections = 100

        return {
          active,
          idle,
          total,
          maxConnections,
          utilizationPercentage: Math.round((total / maxConnections) * 100)
        }
      },
      dependencies: [
        { type: 'system', source: 'database.connections', invalidateOnChange: true }
      ],
      caching: {
        enabled: true,
        ttl: 60, // 1 minute
        invalidateOn: [
          { type: 'time_based', source: '* * * * *' } // Every minute
        ]
      },
      security: {
        allowExternalRequests: false,
        timeout: 2000,
        maxMemoryUsage: 512 * 1024 // 512KB
      },
      createdBy: 'system',
      createdAt: new Date(),
      isActive: true
    }
  }

  /**
   * Get all built-in attributes
   */
  static getAllBuiltInAttributes(): ComputedAttributeDefinition[] {
    return [
      ...this.getUserLevelAttributes(),
      ...this.getDocumentLevelAttributes(),
      ...this.getCollectionLevelAttributes(),
      ...this.getDatabaseLevelAttributes()
    ]
  }

  /**
   * Get built-in attributes by target type
   */
  static getAttributesByTargetType(targetType: 'user' | 'document' | 'collection' | 'database'): ComputedAttributeDefinition[] {
    switch (targetType) {
      case 'user':
        return this.getUserLevelAttributes()
      case 'document':
        return this.getDocumentLevelAttributes()
      case 'collection':
        return this.getCollectionLevelAttributes()
      case 'database':
        return this.getDatabaseLevelAttributes()
      default:
        return []
    }
  }

  /**
   * Get built-in attribute by ID
   */
  static getAttributeById(id: string): ComputedAttributeDefinition | undefined {
    return this.getAllBuiltInAttributes().find(attr => attr.id === id)
  }
}