import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../../CSDatabase'
import { AuthorizationEngine } from '../core/AuthorizationEngine'
import type { User, AuthContext } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationConfig
} from '../interfaces'

describe('AuthorizationEngine', () => {
  let database: CSDatabase
  let authEngine: AuthorizationEngine
  let testUser: User
  let testContext: AuthContext

  beforeEach(async () => {
    // Create test database
    database = new CSDatabase(':memory:')
    await database.connect()

    // Create authorization configuration
    const config: AuthorizationConfig = {
      rbac: {
        enabled: true,
        strictMode: false,
        inheritanceEnabled: true,
        defaultDeny: false
      },
      abac: {
        enabled: true,
        attributeEngine: 'computed-attributes',
        contextAttributes: ['accessLevel', 'lastActivity'],
        defaultDeny: false
      },
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes
        maxSize: 1000,
        strategy: 'lru',
        cleanupInterval: 60 // 1 minute
      },
      rules: {
        enabled: true,
        sandbox: {
          allowedModules: [],
          networkAccess: false,
          fileSystemAccess: false,
          timeout: 5000
        },
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024 // 10MB
      },
      policies: {
        enabled: true,
        defaultPolicy: 'deny',
        policyEvaluationOrder: ['rbac', 'abac', 'dynamic_rules', 'policy']
      }
    }

    // Initialize authorization engine
    authEngine = new AuthorizationEngine(database, config)

    // Create test user
    testUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      roles: ['user'],
      attributes: {
        department: 'engineering',
        accessLevel: 'medium'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    // Create test context
    testContext = {
      ip: '192.168.1.100',
      userAgent: 'test-agent',
      timestamp: Date.now()
    }
  })

    afterEach(async () => {
    try {
      // Clear all caches and dynamic rules
      if (authEngine) {
        await authEngine.clearPermissionCache()
        await authEngine.clearDynamicRules()
      }

      // Close database connection
      if (database) {
        await database.close()
      }
    } catch (error) {
      console.warn('Cleanup error:', error)
    }
  })

  describe('Basic Permission Checking', () => {
    it('should allow access when no restrictions apply', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test-collection'
      }

      const result = await authEngine.checkPermission(
        testUser,
        resource,
        'read',
        testContext
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toContain('combined policy evaluation')
      expect(result.appliedRules.length).toBeGreaterThan(0)
      expect(result.cacheHit).toBe(false)
      expect(result.evaluationTime).toBeGreaterThan(0)
    })

    it('should cache permission results', async () => {
      const resource: ResourceDescriptor = {
        type: 'document',
        collection: 'test-collection',
        documentId: 'doc-1'
      }

      // First call - should not be cached
      const result1 = await authEngine.checkPermission(
        testUser,
        resource,
        'read',
        testContext
      )
      expect(result1.cacheHit).toBe(false)

      // Second call - should be cached
      const result2 = await authEngine.checkPermission(
        testUser,
        resource,
        'read',
        testContext
      )
      expect(result2.cacheHit).toBe(true)
      expect(result2.allowed).toBe(result1.allowed)
    })

    it('should handle batch permission checks', async () => {
      const checks = [
        {
          resource: { type: 'collection', collection: 'users' } as ResourceDescriptor,
          action: 'read'
        },
        {
          resource: { type: 'collection', collection: 'posts' } as ResourceDescriptor,
          action: 'write'
        },
        {
          resource: { type: 'database', database: 'main' } as ResourceDescriptor,
          action: 'admin'
        }
      ]

      const results = await authEngine.checkPermissions(
        testUser,
        checks,
        testContext
      )

      expect(results).toHaveLength(3)
      expect(results.every(r => typeof r.allowed === 'boolean')).toBe(true)
      expect(results.every(r => r.appliedRules.length > 0)).toBe(true)
    })
  })

  describe('Dynamic Rules', () => {
    it('should add and evaluate dynamic rules', async () => {
      // Create business hours context to avoid ABAC time restrictions
      const businessHourTime = new Date()
      businessHourTime.setHours(10, 0, 0, 0) // 10 AM
      businessHourTime.setDate(businessHourTime.getDate() - (businessHourTime.getDay() - 1)) // Monday

      const businessContext = {
        ip: '192.168.1.100',
        userAgent: 'test-agent',
        timestamp: businessHourTime.getTime()
      }

      // Add a deny rule for write actions (non-sensitive action)
      await authEngine.addDynamicRule({
        id: 'deny-write-actions',
        name: 'Deny Write Actions',
        description: 'Deny all write actions for regular users on special collections',
        priority: 100,
        type: 'deny',
        scope: {
          resources: ['collection'],
          actions: ['write', 'update']
        },
        evaluator: async (user, resource, context) => {
          // Deny write to special collections for non-admin users
          return resource.type === 'collection' &&
                 resource.collection === 'special-collection' &&
                 !user.roles.includes('admin')
        },
        isBuiltIn: false,
        isActive: true,
        createdBy: 'test',
        createdAt: new Date()
      })

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'special-collection'
      }

      const result = await authEngine.checkPermission(
        testUser,
        resource,
        'write',
        businessContext
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Denied by rule')
      expect(result.appliedRules).toContain('rule:deny-write-actions')
    })

    it('should remove dynamic rules', async () => {
      const ruleId = 'test-rule'

      // Add rule
      await authEngine.addDynamicRule({
        id: ruleId,
        name: 'Test Rule',
        description: 'Test rule',
        priority: 50,
        type: 'allow',
        scope: {
          resources: ['collection'],
          actions: ['read']
        },
        evaluator: async () => true,
        isBuiltIn: false,
        isActive: true,
        createdBy: 'test',
        createdAt: new Date()
      })

      // Remove rule
      await authEngine.removeDynamicRule(ruleId)

      // Rule should no longer be applied
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = await authEngine.checkPermission(
        testUser,
        resource,
        'read',
        testContext
      )

      expect(result.appliedRules).not.toContain(`rule:${ruleId}`)
    })
  })

  describe('Cache Management', () => {
    it('should clear permission cache', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      // Make a request to populate cache
      await authEngine.checkPermission(testUser, resource, 'read', testContext)

      // Clear cache
      await authEngine.clearPermissionCache()

      // Next request should not be cached
      const result = await authEngine.checkPermission(
        testUser,
        resource,
        'read',
        testContext
      )

      expect(result.cacheHit).toBe(false)
    })

    it('should provide cache statistics', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      // Make some requests
      await authEngine.checkPermission(testUser, resource, 'read', testContext)
      await authEngine.checkPermission(testUser, resource, 'read', testContext) // cached

      const stats = await authEngine.getPermissionCacheStats()

      expect(stats.totalRequests).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should invalidate cache by pattern', async () => {
      const resource1: ResourceDescriptor = {
        type: 'collection',
        collection: 'users'
      }
      const resource2: ResourceDescriptor = {
        type: 'collection',
        collection: 'posts'
      }

      // Populate cache
      await authEngine.checkPermission(testUser, resource1, 'read', testContext)
      await authEngine.checkPermission(testUser, resource2, 'read', testContext)

      // Invalidate cache for 'users' collection
      await authEngine.invalidateCachePattern('.*collection:users.*')

      // Check cache status
      const result1 = await authEngine.checkPermission(testUser, resource1, 'read', testContext)
      const result2 = await authEngine.checkPermission(testUser, resource2, 'read', testContext)

      expect(result1.cacheHit).toBe(false) // invalidated
      expect(result2.cacheHit).toBe(true)  // still cached
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', async () => {
      const newConfig = {
        rbac: {
          enabled: false,
          strictMode: true,
          inheritanceEnabled: false,
          defaultDeny: true
        }
      }

      await authEngine.updateConfig(newConfig)

      const config = authEngine.getConfig()
      expect(config.rbac.enabled).toBe(false)
      expect(config.rbac.strictMode).toBe(true)
    })

    it('should perform health check', async () => {
      const health = await authEngine.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.components.rbacEngine).toBe(true)
      expect(health.components.abacEngine).toBe(true)
      expect(health.components.ruleEngine).toBe(true)
      expect(health.components.cache).toBe(true)
      expect(health.performance.averageResponseTime).toBeGreaterThanOrEqual(0)
      expect(health.performance.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(health.performance.errorRate).toBeGreaterThanOrEqual(0)
      expect(health.lastCheck).toBeInstanceOf(Date)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid dynamic rules', async () => {
      const invalidRule = {
        id: '',
        name: 'Invalid Rule',
        description: 'Missing required fields',
        priority: 100,
        type: 'invalid' as any,
        scope: {
          resources: ['collection' as const],
          actions: ['read']
        },
        evaluator: async () => true,
        isBuiltIn: false,
        isActive: true,
        createdBy: 'test',
        createdAt: new Date()
      }

      await expect(authEngine.addDynamicRule(invalidRule)).rejects.toThrow()
    })

    it('should handle rule evaluation errors gracefully', async () => {
      // Add a rule that throws an error
      await authEngine.addDynamicRule({
        id: 'error-rule',
        name: 'Error Rule',
        description: 'Rule that throws an error',
        priority: 100,
        type: 'deny',
        scope: {
          resources: ['collection'],
          actions: ['read']
        },
        evaluator: async () => {
          throw new Error('Rule evaluation error')
        },
        isBuiltIn: false,
        isActive: true,
        createdBy: 'test',
        createdAt: new Date()
      })

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = await authEngine.checkPermission(
        testUser,
        resource,
        'read',
        testContext
      )

      // Should not fail completely, but handle the error gracefully
      expect(result.appliedRules).toContain('rule:error-rule:error')
    })
  })
})