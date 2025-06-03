import { describe, it, expect, beforeEach } from 'bun:test'
import { PolicyEvaluator } from '../core/PolicyEvaluator'
import type { User } from '../../interfaces/types'
import type {
  ResourceDescriptor,
  AuthorizationResult,
  EvaluationContext,
  SecurityPoliciesConfig
} from '../interfaces'

describe('PolicyEvaluator', () => {
  let policyEvaluator: PolicyEvaluator
  let testUser: User
  let adminUser: User
  let evaluationContext: EvaluationContext

  beforeEach(() => {
    // Create security policies configuration
    const config: SecurityPoliciesConfig = {
      enabled: true,
      defaultPolicy: 'deny',
      policyEvaluationOrder: ['rbac', 'abac', 'dynamic_rules', 'policy']
    }

    // Initialize policy evaluator
    policyEvaluator = new PolicyEvaluator(config)

    // Create test users
    testUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      roles: ['user'],
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
      roles: ['system:super_admin'],
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

  describe('Basic Policy Evaluation', () => {
    it('should allow when policies are disabled', () => {
      const disabledConfig: SecurityPoliciesConfig = {
        enabled: false,
        defaultPolicy: 'deny',
        policyEvaluationOrder: []
      }

      const disabledEvaluator = new PolicyEvaluator(disabledConfig)

      const results: AuthorizationResult[] = [
        {
          allowed: false,
          reason: 'RBAC denied',
          appliedRules: ['rbac:no_permission'],
          cacheHit: false,
          evaluationTime: 10
        }
      ]

      const finalResult = disabledEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(true)
      expect(finalResult.reason).toBe('Security policies disabled')
      expect(finalResult.appliedRules).toContain('policy:disabled')
    })

    it('should apply deny by default principle', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'RBAC allowed',
          appliedRules: ['rbac:permission_match'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'rbac' }
        },
        {
          allowed: false,
          reason: 'ABAC denied',
          appliedRules: ['abac:access_level_insufficient'],
          cacheHit: false,
          evaluationTime: 15,
          metadata: { engine: 'abac' }
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(false)
      expect(finalResult.reason).toContain('Denied by policy')
      expect(finalResult.metadata?.denyingEngine).toBe('abac')
      expect(finalResult.metadata?.totalEngines).toBe(2)
    })

    it('should allow when all engines allow', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'RBAC allowed',
          appliedRules: ['rbac:permission_match'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'rbac' }
        },
        {
          allowed: true,
          reason: 'ABAC allowed',
          appliedRules: ['abac:attributes_valid'],
          cacheHit: false,
          evaluationTime: 15,
          metadata: { engine: 'abac' }
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(true)
      expect(finalResult.reason).toBe('Allowed by combined policy evaluation')
      expect(finalResult.metadata?.allowingEngines).toEqual(['rbac', 'abac'])
    })

    it('should apply default policy when no explicit allows', () => {
      const results: AuthorizationResult[] = []

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(false) // default policy is 'deny'
      expect(finalResult.reason).toContain('No explicit permissions found')
      expect(finalResult.metadata?.defaultPolicy).toBe('deny')
    })
  })

  describe('Evaluation Order', () => {
    it('should apply evaluation order correctly', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: false,
          reason: 'Dynamic rule denied',
          appliedRules: ['rule:test_rule'],
          cacheHit: false,
          evaluationTime: 5,
          metadata: { engine: 'dynamic_rules' }
        },
        {
          allowed: true,
          reason: 'RBAC allowed',
          appliedRules: ['rbac:permission_match'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'rbac' }
        },
        {
          allowed: true,
          reason: 'ABAC allowed',
          appliedRules: ['abac:attributes_valid'],
          cacheHit: false,
          evaluationTime: 15,
          metadata: { engine: 'abac' }
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(false)
      expect(finalResult.metadata?.evaluationOrder).toEqual(['rbac', 'abac', 'dynamic_rules', 'policy'])
    })

    it('should handle missing engines in evaluation order', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'Unknown engine allowed',
          appliedRules: ['unknown:rule'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'unknown' }
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(true)
      expect(finalResult.metadata?.allowingEngines).toContain('unknown')
    })
  })

  describe('Security Policies', () => {
    it('should allow admin override', () => {
      const resource: ResourceDescriptor = {
        type: 'database',
        database: 'restricted'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        adminUser,
        resource,
        'admin',
        evaluationContext
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('Allowed by admin override policy')
      expect(result.appliedRules).toContain('policy:admin_override')
    })

    it('should allow emergency access', () => {
      const emergencyContext: EvaluationContext = {
        ...evaluationContext,
        customData: {
          emergencyAccess: true
        }
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'critical-data'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        testUser,
        resource,
        'read',
        emergencyContext
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('Allowed by emergency access policy')
      expect(result.appliedRules).toContain('policy:emergency_access')
    })

    it('should deny during maintenance mode', () => {
      const maintenanceContext: EvaluationContext = {
        ...evaluationContext,
        customData: {
          maintenanceMode: true
        }
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'user-data'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        testUser,
        resource,
        'write',
        maintenanceContext
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Denied by maintenance mode policy')
      expect(result.appliedRules).toContain('policy:maintenance_mode')
    })

    it('should deny when rate limited', () => {
      const rateLimitedContext: EvaluationContext = {
        ...evaluationContext,
        customData: {
          rateLimited: true
        }
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'api-data'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        testUser,
        resource,
        'read',
        rateLimitedContext
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Denied by rate limiting policy')
      expect(result.appliedRules).toContain('policy:rate_limited')
    })

    it('should allow when no security policies apply', () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'normal-data'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        testUser,
        resource,
        'read',
        evaluationContext
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('No security policy restrictions')
      expect(result.appliedRules).toContain('policy:no_restrictions')
    })
  })

  describe('Engine Identification', () => {
    it('should identify engines from metadata', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['test'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'rbac' }
        },
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['test'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'abac' }
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.metadata?.allowingEngines).toEqual(['rbac', 'abac'])
    })

    it('should identify engines from applied rules', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['rbac:permission'],
          cacheHit: false,
          evaluationTime: 10
        },
        {
          allowed: false,
          reason: 'Test',
          appliedRules: ['abac:denied'],
          cacheHit: false,
          evaluationTime: 10
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(false)
      expect(finalResult.metadata?.denyingEngine).toBe('abac')
    })

    it('should handle unknown engines', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['unknown:rule'],
          cacheHit: false,
          evaluationTime: 10
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.metadata?.allowingEngines).toContain('unknown')
    })
  })

  describe('Applied Rules Combination', () => {
    it('should combine applied rules from all engines', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'RBAC allowed',
          appliedRules: ['rbac:role_check', 'rbac:permission_match'],
          cacheHit: false,
          evaluationTime: 10
        },
        {
          allowed: true,
          reason: 'ABAC allowed',
          appliedRules: ['abac:attribute_check', 'abac:context_valid'],
          cacheHit: false,
          evaluationTime: 15
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.appliedRules).toContain('rbac:role_check')
      expect(finalResult.appliedRules).toContain('rbac:permission_match')
      expect(finalResult.appliedRules).toContain('abac:attribute_check')
      expect(finalResult.appliedRules).toContain('abac:context_valid')
    })

    it('should deduplicate applied rules', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['common:rule', 'rbac:specific'],
          cacheHit: false,
          evaluationTime: 10
        },
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['common:rule', 'abac:specific'],
          cacheHit: false,
          evaluationTime: 15
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      const commonRuleCount = finalResult.appliedRules.filter(rule => rule === 'common:rule').length
      expect(commonRuleCount).toBe(1) // Should be deduplicated
    })
  })

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = policyEvaluator.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.defaultPolicy).toBe('deny')
      expect(config.policyEvaluationOrder).toEqual(['rbac', 'abac', 'dynamic_rules', 'policy'])
    })

    it('should update configuration', () => {
      const newConfig = {
        defaultPolicy: 'allow' as const,
        policyEvaluationOrder: ['abac', 'rbac']
      }

      policyEvaluator.updateConfig(newConfig)

      const config = policyEvaluator.getConfig()
      expect(config.defaultPolicy).toBe('allow')
      expect(config.policyEvaluationOrder).toEqual(['abac', 'rbac'])
    })
  })

  describe('Health Check', () => {
    it('should perform health check successfully', () => {
      const isHealthy = policyEvaluator.healthCheck()
      expect(isHealthy).toBe(true)
    })

    it('should fail health check with invalid configuration', () => {
      const invalidConfig: SecurityPoliciesConfig = {
        enabled: null as any,
        defaultPolicy: 'invalid' as any,
        policyEvaluationOrder: []
      }

      const invalidEvaluator = new PolicyEvaluator(invalidConfig)
      const isHealthy = invalidEvaluator.healthCheck()
      expect(isHealthy).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty results array', () => {
      const results: AuthorizationResult[] = []

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(false) // default deny
      expect(finalResult.reason).toContain('No explicit permissions found')
    })

    it('should handle results with no metadata', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'Test',
          appliedRules: ['test:rule'],
          cacheHit: false,
          evaluationTime: 10
          // No metadata
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      expect(finalResult.allowed).toBe(true)
      expect(finalResult.metadata?.allowingEngines).toBeDefined()
    })

    it('should handle mixed allow/deny results', () => {
      const results: AuthorizationResult[] = [
        {
          allowed: true,
          reason: 'RBAC allowed',
          appliedRules: ['rbac:allow'],
          cacheHit: false,
          evaluationTime: 10,
          metadata: { engine: 'rbac' }
        },
        {
          allowed: false,
          reason: 'ABAC denied',
          appliedRules: ['abac:deny'],
          cacheHit: false,
          evaluationTime: 15,
          metadata: { engine: 'abac' }
        },
        {
          allowed: true,
          reason: 'Rules allowed',
          appliedRules: ['rules:allow'],
          cacheHit: false,
          evaluationTime: 5,
          metadata: { engine: 'dynamic_rules' }
        }
      ]

      const finalResult = policyEvaluator.combineResults(results, evaluationContext)

      // Should deny because of deny-by-default principle
      expect(finalResult.allowed).toBe(false)
      expect(finalResult.metadata?.denyingEngine).toBe('abac')
    })
  })

  describe('Admin Override Detection', () => {
    it('should detect system super admin', () => {
      const resource: ResourceDescriptor = {
        type: 'database',
        database: 'test'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        adminUser, // has 'system:super_admin' role
        resource,
        'admin',
        evaluationContext
      )

      expect(result.allowed).toBe(true)
      expect(result.appliedRules).toContain('policy:admin_override')
    })

    it('should detect admin roles', () => {
      const adminUserVariant: User = {
        ...testUser,
        roles: ['admin', 'user']
      }

      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        adminUserVariant,
        resource,
        'read',
        evaluationContext
      )

      expect(result.allowed).toBe(true)
      expect(result.appliedRules).toContain('policy:admin_override')
    })

    it('should not detect admin for regular users', () => {
      const resource: ResourceDescriptor = {
        type: 'collection',
        collection: 'test'
      }

      const result = policyEvaluator.evaluateSecurityPolicies(
        testUser, // regular user
        resource,
        'read',
        evaluationContext
      )

      expect(result.appliedRules).not.toContain('policy:admin_override')
    })
  })
})