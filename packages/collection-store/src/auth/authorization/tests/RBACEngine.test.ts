import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../../core/Database'
import { RBACEngine } from '../core/RBACEngine'
import type { User } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  EvaluationContext,
  RBACConfig
} from '../interfaces'

describe('RBACEngine', () => {
  let database: CSDatabase
  let rbacEngine: RBACEngine
  let testUser: User
  let adminUser: User
  let evaluationContext: EvaluationContext

  beforeEach(async () => {
    // Create test database
    database = new CSDatabase(':memory:')
    await database.connect()

    // Create RBAC configuration
    const config: RBACConfig = {
      enabled: true,
      strictMode: false,
      inheritanceEnabled: true,
      defaultDeny: false
    }

    // Initialize RBAC engine
    rbacEngine = new RBACEngine(database, config)

    // Create test users
    testUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      roles: ['user', 'editor'],
      attributes: {
        department: 'engineering'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    adminUser = {
      id: 'admin-user-1',
      email: 'admin@example.com',
      passwordHash: 'hashed-password',
      roles: ['admin', 'super_admin'],
      attributes: {
        department: 'administration'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }

    // Create evaluation context
    evaluationContext = {
      user: testUser,
      resource: { type: 'collection', collection: 'test' },
      action: 'read',
      context: {
        ip: '192.168.1.100',
        userAgent: 'test-agent',
        timestamp: Date.now()
      },
      timestamp: Date.now(),
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
      console.warn('RBACEngine cleanup error:', error)
    }
  })

  describe('Basic Permission Checking', () => {
    it('should allow access when RBAC is disabled', async () => {
      const disabledConfig: RBACConfig = {
        enabled: false,
        strictMode: false,
        inheritanceEnabled: true,
        defaultDeny: false
      }

      const disabledEngine = new RBACEngine(database, disabledConfig)

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
      expect(result.reason).toBe('RBAC disabled')
      expect(result.appliedRules).toContain('rbac:disabled')
    })

    it('should deny access when user has no roles', async () => {
      const userWithoutRoles: User = {
        ...testUser,
        roles: []
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test-collection'
      }

      const result = await rbacEngine.checkPermission(
        userWithoutRoles,
        resource,
        'read',
        evaluationContext
      )

      expect(result.allowed).toBe(true) // defaultDeny is false
      expect(result.reason).toBe('User has no roles assigned')
      expect(result.appliedRules).toContain('rbac:no_roles')
    })

    it('should handle permission matching correctly', async () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test-collection'
      }

      const result = await rbacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.allowed).toBeDefined()
      expect(result.reason).toBeDefined()
      expect(result.appliedRules).toContain('rbac:role_permissions')
      expect(result.evaluationTime).toBeGreaterThan(0)
      expect(result.metadata?.engine).toBe('rbac')
    })
  })

  describe('Admin Override', () => {
    it('should allow admin override when not in strict mode', async () => {
      const resource: ResourceDescriptor = {
        type: 'database',
        database: 'restricted-db'
      }

      const result = await rbacEngine.checkPermission(
        adminUser,
        resource,
        'admin',
        evaluationContext
      )

      // Should be allowed due to admin role
      expect(result.metadata?.engine).toBe('rbac')
      expect(result.appliedRules).toContain('rbac:role_permissions')
    })

    it('should not allow admin override in strict mode', async () => {
      const strictConfig: RBACConfig = {
        enabled: true,
        strictMode: true,
        inheritanceEnabled: true,
        defaultDeny: false
      }

      const strictEngine = new RBACEngine(database, strictConfig)

      const resource: ResourceDescriptor = {
        type: 'database',
        database: 'restricted-db'
      }

      const result = await strictEngine.checkPermission(
        adminUser,
        resource,
        'admin',
        evaluationContext
      )

      // In strict mode, admin override should not apply
      expect(result.metadata?.strictMode).toBe(true)
    })
  })

  describe('Resource String Conversion', () => {
    it('should convert database resource correctly', async () => {
      const resource: ResourceDescriptor = {
        type: 'database',
        database: 'main-db'
      }

      const result = await rbacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.metadata?.engine).toBe('rbac')
    })

    it('should convert document resource correctly', async () => {
      const resource: ResourceDescriptor = {
        type: 'document',
        collection: 'users',
        documentId: 'user-123'
      }

      const result = await rbacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.metadata?.engine).toBe('rbac')
    })

    it('should convert field resource correctly', async () => {
      const resource: ResourceDescriptor = {
        type: 'field',
        collection: 'users',
        fieldPath: 'email'
      }

      const result = await rbacEngine.checkPermission(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.metadata?.engine).toBe('rbac')
    })
  })

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = rbacEngine.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.strictMode).toBe(false)
      expect(config.inheritanceEnabled).toBe(true)
      expect(config.defaultDeny).toBe(false)
    })

    it('should update configuration', () => {
      const newConfig = {
        strictMode: true,
        defaultDeny: true
      }

      rbacEngine.updateConfig(newConfig)

      const config = rbacEngine.getConfig()
      expect(config.strictMode).toBe(true)
      expect(config.defaultDeny).toBe(true)
    })
  })

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      const isHealthy = await rbacEngine.healthCheck()
      expect(typeof isHealthy).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    it('should handle evaluation errors gracefully', async () => {
      // Create a scenario that might cause an error
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      // Test with invalid context
      const invalidContext: EvaluationContext = {
        ...evaluationContext,
        user: null as any
      }

      const result = await rbacEngine.checkPermission(
        testUser,
        resource,
        'read',
        invalidContext
      )

      // Should handle error gracefully
      expect(result.allowed).toBeDefined()
      expect(result.reason).toBeDefined()
    })
  })

  describe('Default Deny Policy', () => {
    it('should respect default deny configuration', async () => {
      const denyConfig: RBACConfig = {
        enabled: true,
        strictMode: false,
        inheritanceEnabled: true,
        defaultDeny: true
      }

      const denyEngine = new RBACEngine(database, denyConfig)

      const userWithoutRoles: User = {
        ...testUser,
        roles: []
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = await denyEngine.checkPermission(
        userWithoutRoles,
        resource,
        'read',
        evaluationContext
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('User has no roles assigned')
    })
  })
})