import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  DependencyTracker,
  MemoryLimitManager,
  ComputationContextBuilder,
  SimpleHttpClient
} from '../core'
import type {
  AttributeDependencyDetailed,
  ComputationContext
} from '../types'

// Helper function to create test dependency
function createTestDependency(
  id: string,
  attributeId: string,
  type: 'field' | 'collection' | 'external_api' | 'system' | 'computed_attribute' = 'computed_attribute',
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): AttributeDependencyDetailed {
  return {
    id,
    attributeId,
    type,
    source: `source-${id}`,
    targetType: 'user',
    invalidateOnChange: true,
    priority,
    cacheable: true
  }
}

// Mock database for testing
const mockDatabase = {
  name: 'test-db',
  collections: new Map(),
  query: async () => ({ results: [] }),
  insert: async () => ({ id: 'test-id' }),
  update: async () => ({ modified: 1 }),
  delete: async () => ({ deleted: 1 })
} as any

describe('Day 4 Components', () => {
  describe('DependencyTracker', () => {
    let tracker: DependencyTracker

    beforeEach(async () => {
      tracker = new DependencyTracker({
        maxDependencyDepth: 5,
        enableCircularDependencyDetection: true,
        maxDependenciesPerAttribute: 10
      })
      await tracker.initialize()
    })

    test('should initialize successfully', async () => {
      const newTracker = new DependencyTracker()
      await newTracker.initialize()
      // Should not throw
    })

    test('should throw error when initializing twice', async () => {
      expect(async () => {
        await tracker.initialize()
      }).toThrow()
    })

    test('should add dependency successfully', async () => {
      const dependency = createTestDependency('dep1', 'attr2')
      await tracker.addDependency('attr1', dependency)

      const dependencies = await tracker.getDependencies('attr1')
      expect(dependencies).toHaveLength(1)
      expect(dependencies[0].attributeId).toBe('attr2')
    })

    test('should detect circular dependencies', async () => {
      const dep1 = createTestDependency('dep1', 'attr2')
      const dep2 = createTestDependency('dep2', 'attr1')

      await tracker.addDependency('attr1', dep1)

      expect(async () => {
        await tracker.addDependency('attr2', dep2)
      }).toThrow()
    })

    test('should resolve dependency order', async () => {
      const dep1 = createTestDependency('dep1', 'attr2')
      const dep2 = createTestDependency('dep2', 'attr3')

      await tracker.addDependency('attr1', dep1)
      await tracker.addDependency('attr2', dep2)

      const order = await tracker.resolveDependencies(['attr1'])
      expect(order).toEqual(['attr3', 'attr2', 'attr1'])
    })

    test('should validate dependencies', async () => {
      const validDep = createTestDependency('dep1', 'attr2')
      const invalidDep = createTestDependency('dep2', 'attr1') // self-dependency

      const validResult = await tracker.validateDependency('attr1', validDep)
      expect(validResult.isValid).toBe(true)

      const invalidResult = await tracker.validateDependency('attr1', invalidDep)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Attribute cannot depend on itself')
    })

    test('should get affected attributes', async () => {
      const dep1 = createTestDependency('dep1', 'attr2')
      const dep2 = createTestDependency('dep2', 'attr3')

      await tracker.addDependency('attr1', dep1)
      await tracker.addDependency('attr2', dep2)

      const affected = tracker.getAffectedAttributes('attr3')
      expect(affected).toContain('attr2')
      expect(affected).toContain('attr1')
    })

    test('should emit dependency change events', async () => {
      let eventReceived = false
      tracker.on('dependencyChanged', (event) => {
        expect(event.type).toBe('added')
        expect(event.attributeId).toBe('attr1')
        eventReceived = true
      })

      const dependency = createTestDependency('dep1', 'attr2')
      await tracker.addDependency('attr1', dependency)
      expect(eventReceived).toBe(true)
    })
  })

  describe('MemoryLimitManager', () => {
    let manager: MemoryLimitManager

    beforeEach(async () => {
      manager = new MemoryLimitManager({
        maxMemoryUsage: 1024 * 1024, // 1MB
        maxComputeTime: 5000, // 5 seconds
        enableMemoryMonitoring: true,
        enableTimeoutProtection: true
      })
      await manager.initialize()
    })

    afterEach(async () => {
      await manager.cleanup()
    })

    test('should initialize successfully', async () => {
      const newManager = new MemoryLimitManager()
      await newManager.initialize()
      // Should not throw
    })

    test('should start and end computation tracking', async () => {
      const computationId = await manager.startComputation('attr1', 'target1')
      expect(computationId).toBeDefined()
      expect(manager.getActiveComputationsCount()).toBe(1)

      await manager.endComputation(computationId)
      expect(manager.getActiveComputationsCount()).toBe(0)
    })

    test('should provide memory statistics', () => {
      const stats = manager.getMemoryStats()
      expect(stats).toBeDefined()
      expect(typeof stats.currentUsage).toBe('number')
      expect(typeof stats.usagePercentage).toBe('number')
      expect(typeof stats.isNearLimit).toBe('boolean')
    })

    test('should track active computations', async () => {
      const computationId1 = await manager.startComputation('attr1', 'target1')
      const computationId2 = await manager.startComputation('attr2', 'target2')

      const active = manager.getActiveComputations()
      expect(active).toHaveLength(2)
      expect(active[0].attributeId).toBe('attr1')
      expect(active[1].attributeId).toBe('attr2')

      await manager.endComputation(computationId1)
      await manager.endComputation(computationId2)
    })

    test('should handle timeout protection', async () => {
      const computationId = await manager.startComputation('attr1', 'target1')

      const slowPromise = new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds

      expect(async () => {
        await manager.withTimeout(slowPromise, computationId, 100) // 100ms timeout
      }).toThrow()

      await manager.endComputation(computationId)
    })

    test('should emit computation events', async () => {
      let startEventReceived = false
      let endEventReceived = false

      manager.on('computationStarted', (event) => {
        expect(event.attributeId).toBe('attr1')
        startEventReceived = true
      })

      manager.on('computationEnded', (event) => {
        expect(event.attributeId).toBe('attr1')
        endEventReceived = true
      })

      const computationId = await manager.startComputation('attr1', 'target1')
      await manager.endComputation(computationId)

      expect(startEventReceived).toBe(true)
      expect(endEventReceived).toBe(true)
    })

    test('should cleanup all computations', async () => {
      await manager.startComputation('attr1', 'target1')
      await manager.startComputation('attr2', 'target2')
      expect(manager.getActiveComputationsCount()).toBe(2)

      await manager.cleanup()
      expect(manager.getActiveComputationsCount()).toBe(0)
    })
  })

  describe('ComputationContextBuilder', () => {
    let builder: ComputationContextBuilder

    beforeEach(async () => {
      builder = new ComputationContextBuilder({
        enableHttpClient: true,
        enableDatabaseAccess: true,
        enableUserContext: true,
        enableCustomData: true
      })
      await builder.initialize()
    })

    test('should initialize successfully', async () => {
      const newBuilder = new ComputationContextBuilder()
      await newBuilder.initialize()
      // Should not throw
    })

    test('should build basic context', async () => {
      const context = await builder.buildContext({
        target: { id: 'user1', name: 'Test User' },
        targetId: 'user1',
        targetType: 'user',
        database: mockDatabase
      })

      expect(context.targetId).toBe('user1')
      expect(context.targetType).toBe('user')
      expect(context.database).toBe(mockDatabase)
      expect(context.timestamp).toBeDefined()
      expect(context.nodeId).toBeDefined()
    })

    test('should build user context', async () => {
      const user = { id: 'user1', name: 'Test User' }
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        passwordHash: 'hash',
        roles: [],
        attributes: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      }
      const context = await builder.buildUserContext(
        user,
        'user1',
        mockDatabase,
        mockUser,
        { custom: 'data' }
      )

      expect(context.targetType).toBe('user')
      expect(context.target).toBe(user)
      expect(context.currentUser).toBe(mockUser)
      expect(context.customData?.custom).toBe('data')
    })

    test('should build document context', async () => {
      const document = { id: 'doc1', title: 'Test Document' }
      const collection = { name: 'documents' }

      const context = await builder.buildDocumentContext(
        document,
        'doc1',
        collection,
        mockDatabase
      )

      expect(context.targetType).toBe('document')
      expect(context.target).toBe(document)
      expect(context.currentCollection).toBe(collection)
    })

    test('should validate required fields', async () => {
      expect(async () => {
        await builder.buildContext({
          target: {},
          targetId: '', // Invalid empty ID
          targetType: 'user',
          database: mockDatabase
        })
      }).toThrow()

      expect(async () => {
        await builder.buildContext({
          target: {},
          targetId: 'valid-id',
          targetType: 'invalid' as any, // Invalid target type
          database: mockDatabase
        })
      }).toThrow()
    })

    test('should create auth context', () => {
      const authContext = builder.createAuthContext(
        '192.168.1.1',
        'Mozilla/5.0',
        'us-east-1',
        { sessionId: 'session123' }
      )

      expect(authContext.ip).toBe('192.168.1.1')
      expect(authContext.userAgent).toBe('Mozilla/5.0')
      expect(authContext.region).toBe('us-east-1')
      expect(authContext.customAttributes?.sessionId).toBe('session123')
    })

    test('should handle custom data size limits', async () => {
      const largeData = { data: 'x'.repeat(2 * 1024 * 1024) } // 2MB of data

      expect(async () => {
        await builder.buildContext({
          target: {},
          targetId: 'test',
          targetType: 'user',
          database: mockDatabase,
          customData: largeData
        })
      }).toThrow()
    })

    test('should update configuration', () => {
      const originalConfig = builder.getConfig()
      expect(originalConfig.enableHttpClient).toBe(true)

      builder.updateConfig({ enableHttpClient: false })
      const updatedConfig = builder.getConfig()
      expect(updatedConfig.enableHttpClient).toBe(false)
    })
  })

  describe('SimpleHttpClient', () => {
    let httpClient: SimpleHttpClient

    beforeEach(() => {
      httpClient = new SimpleHttpClient(1000) // 1 second timeout
    })

    test('should create http client', () => {
      expect(httpClient).toBeDefined()
      expect(typeof httpClient.get).toBe('function')
      expect(typeof httpClient.post).toBe('function')
      expect(typeof httpClient.put).toBe('function')
      expect(typeof httpClient.delete).toBe('function')
    })

    // Note: These tests would require a mock fetch or actual HTTP server
    // For now, we just test the interface exists
    test('should have correct method signatures', () => {
      expect(httpClient.get).toBeDefined()
      expect(httpClient.post).toBeDefined()
      expect(httpClient.put).toBeDefined()
      expect(httpClient.delete).toBeDefined()
    })
  })
})