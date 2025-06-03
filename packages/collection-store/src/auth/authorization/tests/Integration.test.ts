import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../../CSDatabase'
import { AuthorizationEngine } from '../core/AuthorizationEngine'
import { RBACEngine } from '../core/RBACEngine'
import { ABACEngine } from '../core/ABACEngine'
import { PolicyEvaluator } from '../core/PolicyEvaluator'
import type { User, AuthContext } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationConfig,
  RBACConfig,
  ABACConfig,
  SecurityPoliciesConfig
} from '../interfaces'

describe('Phase 2 Authorization System Integration', () => {
  let database: CSDatabase
  let authEngine: AuthorizationEngine
  let testUser: User
  let adminUser: User
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
        ttl: 300,
        maxSize: 1000,
        strategy: 'lru',
        cleanupInterval: 60
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
        maxMemoryUsage: 10 * 1024 * 1024
      },
      policies: {
        enabled: true,
        defaultPolicy: 'deny',
        policyEvaluationOrder: ['rbac', 'abac', 'dynamic_rules', 'policy']
      }
    }

    // Initialize authorization engine
    authEngine = new AuthorizationEngine(database, config)

    // Create test users
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

    adminUser = {
      id: 'admin-user-1',
      email: 'admin@example.com',
      passwordHash: 'hashed-password',
      roles: ['system:super_admin'],
      attributes: {
        department: 'administration',
        accessLevel: 'high'
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
      console.warn('Integration cleanup error:', error)
    }
  })

  describe('Core Engine Initialization', () => {
    it('should initialize all engines successfully', () => {
      expect(authEngine).toBeDefined()
      expect(authEngine.getConfig()).toBeDefined()
    })

    it('should create individual engines', async () => {
      const rbacConfig: RBACConfig = {
        enabled: true,
        strictMode: false,
        inheritanceEnabled: true,
        defaultDeny: false
      }

      const abacConfig: ABACConfig = {
        enabled: true,
        attributeEngine: 'computed-attributes',
        contextAttributes: ['accessLevel'],
        defaultDeny: false
      }

      const policyConfig: SecurityPoliciesConfig = {
        enabled: true,
        defaultPolicy: 'deny',
        policyEvaluationOrder: ['rbac', 'abac']
      }

      const rbacEngine = new RBACEngine(database, rbacConfig)
      const abacEngine = new ABACEngine(database, abacConfig)
      const policyEvaluator = new PolicyEvaluator(policyConfig)

      expect(rbacEngine).toBeDefined()
      expect(abacEngine).toBeDefined()
      expect(policyEvaluator).toBeDefined()

      // Test configuration access
      expect(rbacEngine.getConfig().enabled).toBe(true)
      expect(abacEngine.getConfig().enabled).toBe(true)
      expect(policyEvaluator.getConfig().enabled).toBe(true)
    })
  })

  describe('Basic Permission Checking', () => {
    it('should handle permission requests without errors', async () => {
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

      // Should return a valid result structure
      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
      expect(typeof result.reason).toBe('string')
      expect(Array.isArray(result.appliedRules)).toBe(true)
      expect(typeof result.cacheHit).toBe('boolean')
      expect(typeof result.evaluationTime).toBe('number')
    })

    it('should handle different resource types', async () => {
      const resources: ResourceDescriptor[] = [
        { type: 'database', database: 'main' },
        { type: 'collection', collection: 'users' },
        { type: 'document', collection: 'users', documentId: 'user-123' },
        { type: 'field', collection: 'users', fieldPath: 'email' }
      ]

      for (const resource of resources) {
        const result = await authEngine.checkPermission(
          testUser,
          resource,
          'read',
          testContext
        )

        expect(result).toBeDefined()
        expect(typeof result.allowed).toBe('boolean')
      }
    })
  })

  describe('Cache Functionality', () => {
    it('should provide cache statistics', async () => {
      const stats = await authEngine.getPermissionCacheStats()

      expect(stats).toBeDefined()
      expect(typeof stats.hits).toBe('number')
      expect(typeof stats.misses).toBe('number')
      expect(typeof stats.totalRequests).toBe('number')
      expect(typeof stats.hitRate).toBe('number')
      expect(typeof stats.size).toBe('number')
    })

    it('should clear cache without errors', async () => {
      await authEngine.clearPermissionCache()
      await authEngine.clearPermissionCache('specific-user')

      // Should not throw errors
      expect(true).toBe(true)
    })

    it('should invalidate cache by pattern', async () => {
      await authEngine.invalidateCachePattern('test-pattern')

      // Should not throw errors
      expect(true).toBe(true)
    })
  })

  describe('Dynamic Rules', () => {
    it('should add and remove dynamic rules', async () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 100,
        type: 'allow' as const,
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

      await authEngine.addDynamicRule(rule)
      await authEngine.removeDynamicRule('test-rule')

      // Should not throw errors
      expect(true).toBe(true)
    })

    it('should validate dynamic rules', async () => {
      const invalidRule = {
        id: '',
        name: 'Invalid Rule',
        description: 'Invalid rule',
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
  })

  describe('Configuration Management', () => {
    it('should get and update configuration', async () => {
      const config = authEngine.getConfig()
      expect(config).toBeDefined()
      expect(config.rbac).toBeDefined()
      expect(config.abac).toBeDefined()
      expect(config.cache).toBeDefined()
      expect(config.rules).toBeDefined()
      expect(config.policies).toBeDefined()

      const newConfig = {
        rbac: {
          enabled: false,
          strictMode: true,
          inheritanceEnabled: false,
          defaultDeny: true
        }
      }

      await authEngine.updateConfig(newConfig)

      const updatedConfig = authEngine.getConfig()
      expect(updatedConfig.rbac.enabled).toBe(false)
      expect(updatedConfig.rbac.strictMode).toBe(true)
    })
  })

  describe('Health Monitoring', () => {
    it('should provide health status', async () => {
      const health = await authEngine.healthCheck()

      expect(health).toBeDefined()
      expect(typeof health.healthy).toBe('boolean')
      expect(health.components).toBeDefined()
      expect(health.performance).toBeDefined()
      expect(health.lastCheck).toBeInstanceOf(Date)

      // Components should be defined
      expect(typeof health.components.rbacEngine).toBe('boolean')
      expect(typeof health.components.abacEngine).toBe('boolean')
      expect(typeof health.components.ruleEngine).toBe('boolean')
      expect(typeof health.components.cache).toBe('boolean')

      // Performance metrics should be numbers
      expect(typeof health.performance.averageResponseTime).toBe('number')
      expect(typeof health.performance.cacheHitRate).toBe('number')
      expect(typeof health.performance.errorRate).toBe('number')
    })
  })

  describe('Batch Operations', () => {
    it('should handle batch permission checks', async () => {
      const checks = [
        {
          resource: { type: 'collection', collection: 'users' } as ResourceDescriptor,
          action: 'read'
        },
        {
          resource: { type: 'collection', collection: 'posts' } as ResourceDescriptor,
          action: 'write'
        }
      ]

      const results = await authEngine.checkPermissions(
        testUser,
        checks,
        testContext
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => typeof r.allowed === 'boolean')).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid resource types gracefully', async () => {
      const invalidResource = {
        type: 'invalid' as any,
        collection: 'test'
      }

      const result = await authEngine.checkPermission(
        testUser,
        invalidResource,
        'read',
        testContext
      )

      // Should return a result even for invalid resources
      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
    })

    it('should handle missing context gracefully', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = await authEngine.checkPermission(
        testUser,
        resource,
        'read'
        // No context provided
      )

      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
    })
  })

  describe('Security Policies', () => {
    it('should handle admin override detection', () => {
      const policyConfig: SecurityPoliciesConfig = {
        enabled: true,
        defaultPolicy: 'deny',
        policyEvaluationOrder: ['policy']
      }

      const policyEvaluator = new PolicyEvaluator(policyConfig)

      const resource: ResourceDescriptor = {
        type: 'database',
        database: 'test'
      }

      const evaluationContext = {
        user: adminUser,
        resource,
        action: 'admin',
        context: testContext,
        timestamp: Date.now(),
        nodeId: 'test'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        adminUser,
        resource,
        'admin',
        evaluationContext
      )

      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
    })
  })

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const promises = Array.from({ length: 10 }, () =>
        authEngine.checkPermission(testUser, resource, 'read', testContext)
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(results.every(r => typeof r.allowed === 'boolean')).toBe(true)
    })

    it('should track performance metrics', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      // Make some requests to generate metrics
      await authEngine.checkPermission(testUser, resource, 'read', testContext)
      await authEngine.checkPermission(testUser, resource, 'write', testContext)

      const health = await authEngine.healthCheck()
      expect(health.performance.averageResponseTime).toBeGreaterThanOrEqual(0)
    })
  })
})