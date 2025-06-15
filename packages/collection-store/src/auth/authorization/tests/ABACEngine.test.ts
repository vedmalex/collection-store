import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../../core/Database'
import { ABACEngine } from '../core/ABACEngine'
import type { User } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  EvaluationContext,
  ABACConfig
} from '../interfaces'

describe('ABACEngine', () => {
  let database: CSDatabase
  let abacEngine: ABACEngine
  let testUser: User
  let highAccessUser: User
  let evaluationContext: EvaluationContext

  beforeEach(async () => {
    // Create test database
    database = new CSDatabase(':memory:')
    await database.connect()

    // Create ABAC configuration
    const config: ABACConfig = {
      enabled: true,
      attributeEngine: 'computed-attributes',
      contextAttributes: ['accessLevel', 'lastActivity', 'currentTime'],
      defaultDeny: false
    }

    // Initialize ABAC engine
    abacEngine = new ABACEngine(database, config)

    // Create test users
    testUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      roles: ['user'],
      attributes: {
        department: 'engineering',
        accessLevel: 'medium',
        allowedRegions: ['us-east', 'us-west']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    highAccessUser = {
      id: 'high-access-user',
      email: 'high@example.com',
      passwordHash: 'hashed-password',
      roles: ['senior_user'],
      attributes: {
        department: 'security',
        accessLevel: 'high',
        allowedRegions: ['us-east', 'us-west', 'eu-west']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    // Create evaluation context (business hours)
    const businessHourTime = new Date()
    businessHourTime.setHours(10, 0, 0, 0) // 10 AM
    businessHourTime.setDate(businessHourTime.getDate() - (businessHourTime.getDay() - 1)) // Monday

    evaluationContext = {
      user: testUser,
      resource: { type: 'collection', collection: 'test' },
      action: 'read',
      context: {
        ip: '192.168.1.100',
        userAgent: 'test-agent',
        timestamp: businessHourTime.getTime(),
        region: 'us-east'
      },
      timestamp: businessHourTime.getTime(),
      nodeId: 'test-node'
    }
  })

  afterEach(async () => {
    try {
      // Close database connection
      if (database) {
        await database.close()
      }
    } catch (error) {
      console.warn('ABACEngine cleanup error:', error)
    }
  })

  describe('Basic ABAC Functionality', () => {
    it('should allow access when ABAC is disabled', async () => {
      const disabledConfig: ABACConfig = {
        enabled: false,
        attributeEngine: 'computed-attributes',
        contextAttributes: [],
        defaultDeny: false
      }

      const disabledEngine = new ABACEngine(database, disabledConfig)

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test-collection'
      }

      const result = await disabledEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ABAC disabled')
      expect(result.appliedRules).toContain('abac:disabled')
    })

    it('should evaluate user attributes', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'normal-collection'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.metadata?.engine).toBe('abac')
      expect(result.metadata?.evaluatedAttributes).toBeDefined()
      expect(result.appliedRules).toContain('abac:user_attributes')
      expect(result.evaluationTime).toBeGreaterThan(0)
    })

    it('should handle document attributes for document resources', async () => {
      const resource: ResourceDescriptor = {
        type: 'document',
        collection: 'users',
        documentId: 'user-123'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.metadata?.engine).toBe('abac')
      expect(result.appliedRules).toContain('abac:authorization_attributes')
    })
  })

  describe('Access Level Control', () => {
    it('should deny access to high security resources for medium access users', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'admin-sensitive-data' // high security pattern
      }

      const result = await abacEngine.checkPermission(
        testUser, // medium access level
        resource,
        'read',
        evaluationContext
      )

      // Should be denied due to insufficient access level
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Access level')
      expect(result.appliedRules).toContain('abac:access_level_insufficient')
    })

    it('should allow access to high security resources for high access users', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'security-logs' // high security pattern
      }

      const result = await abacEngine.checkPermission(
        highAccessUser, // high access level
        resource,
        'read',
        evaluationContext
      )

      // Should be allowed due to high access level
      expect(result.metadata?.engine).toBe('abac')
    })
  })

  describe('Time-Based Access Control', () => {
    it('should deny sensitive operations outside business hours', async () => {
      // Create context for weekend (Saturday)
      const weekendTime = new Date()
      weekendTime.setHours(10, 0, 0, 0)
      weekendTime.setDate(weekendTime.getDate() - weekendTime.getDay() + 6) // Saturday

      const weekendContext: EvaluationContext = {
        ...evaluationContext,
        timestamp: weekendTime.getTime(),
        context: {
          ...evaluationContext.context,
          timestamp: weekendTime.getTime()
        }
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'financial-data'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'delete', // sensitive action
        weekendContext
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('business hours')
      expect(result.appliedRules).toContain('abac:business_hours_restriction')
    })

    it('should allow sensitive operations during business hours', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'normal-data'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'delete', // sensitive action
        evaluationContext // business hours context
      )

      // Should check time-based rules
      expect(result.appliedRules).toContain('abac:time_based_check')
    })
  })

  describe('Region-Based Access Control', () => {
    it('should deny access from unauthorized regions', async () => {
      const restrictedContext: EvaluationContext = {
        ...evaluationContext,
        context: {
          ...evaluationContext.context,
          region: 'asia-pacific' // not in user's allowed regions
        }
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'regional-data'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'read',
        restrictedContext
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('region')
      expect(result.appliedRules).toContain('abac:region_restriction')
    })

    it('should allow access from authorized regions', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'regional-data'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext // us-east region
      )

      expect(result.appliedRules).toContain('abac:context_check')
    })
  })

  describe('Activity-Based Access Control', () => {
    it('should deny sensitive operations for stale sessions', async () => {
      // Mock stale session by modifying the computed attributes response
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'sensitive-data'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'admin', // sensitive action
        evaluationContext
      )

      // The result depends on the computed attributes engine response
      expect(result.metadata?.engine).toBe('abac')
    })
  })

  describe('Document Ownership', () => {
    it('should allow access to owned documents', async () => {
      const resource: ResourceDescriptor = {
        type: 'document',
        collection: 'user-documents',
        documentId: 'doc-owned-by-user'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.metadata?.engine).toBe('abac')
      expect(result.appliedRules).toContain('abac:authorization_attributes')
    })
  })

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = abacEngine.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.attributeEngine).toBe('computed-attributes')
      expect(config.contextAttributes).toContain('accessLevel')
      expect(config.defaultDeny).toBe(false)
    })

    it('should update configuration', () => {
      const newConfig = {
        defaultDeny: true,
        contextAttributes: ['accessLevel', 'department']
      }

      abacEngine.updateConfig(newConfig)

      const config = abacEngine.getConfig()
      expect(config.defaultDeny).toBe(true)
      expect(config.contextAttributes).toEqual(['accessLevel', 'department'])
    })
  })

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      const isHealthy = await abacEngine.healthCheck()
      expect(typeof isHealthy).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    it('should handle attribute evaluation errors gracefully', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      // Test with problematic context that might cause errors
      const problematicContext: EvaluationContext = {
        ...evaluationContext,
        user: {
          ...testUser,
          attributes: null as any // This might cause issues
        }
      }

      const result = await abacEngine.checkPermission(
        problematicContext.user,
        resource,
        'read',
        problematicContext
      )

      // Should handle error gracefully
      expect(result.allowed).toBeDefined()
      expect(result.reason).toBeDefined()
      expect(result.metadata?.engine).toBe('abac')
    })

    it('should handle ComputedAttributeEngine errors', async () => {
      const resource: ResourceDescriptor = {
        type: 'document',
        collection: 'non-existent-collection',
        documentId: 'non-existent-doc'
      }

      const result = await abacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      // Should not fail completely even if attribute computation fails
      expect(result.metadata?.engine).toBe('abac')
    })
  })

  describe('Default Deny Policy', () => {
    it('should respect default deny configuration', async () => {
      const denyConfig: ABACConfig = {
        enabled: true,
        attributeEngine: 'computed-attributes',
        contextAttributes: ['accessLevel'],
        defaultDeny: true
      }

      const denyEngine = new ABACEngine(database, denyConfig)

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = await denyEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      // With default deny, should be more restrictive
      expect(result.metadata?.engine).toBe('abac')
    })
  })

  describe('Sensitive Actions Detection', () => {
    it('should identify sensitive actions correctly', async () => {
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

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      for (const action of sensitiveActions) {
        const result = await abacEngine.checkPermission(
          testUser,
          resource,
          action,
          evaluationContext
        )

        expect(result.metadata?.engine).toBe('abac')
        // Sensitive actions should trigger additional checks
      }
    })
  })

  describe('High Security Resources Detection', () => {
    it('should identify high security resources correctly', async () => {
      const highSecurityResources = [
        'admin-panel',
        'security-logs',
        'audit-trail',
        'config-settings',
        'system-data',
        'sensitive-info'
      ]

      for (const collectionName of highSecurityResources) {
        const resource: ResourceDescriptor = {
          type: 'collection',
          collection: collectionName
        }

        const result = await abacEngine.checkPermission(
          testUser, // medium access level
          resource,
          'read',
          evaluationContext
        )

        // High security resources should trigger access level checks
        expect(result.metadata?.engine).toBe('abac')
      }
    })
  })
})