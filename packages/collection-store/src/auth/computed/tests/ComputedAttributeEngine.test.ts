import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ComputedAttributeEngine } from '../core/ComputedAttributeEngine'
import type { ComputedAttributeDefinition, ComputationContext, ComputeFunction } from '../types'
import { ComputedAttributeErrorCodeDetailed } from '../types/ErrorTypes'

// Helper function to create test attribute definitions
function createTestAttribute(
  id: string,
  name: string,
  targetType: 'user' | 'document' | 'collection' | 'database',
  computeFunction: ComputeFunction,
  description = 'Test attribute'
): ComputedAttributeDefinition {
  return {
    id,
    name,
    description,
    targetType,
    computeFunction,
    dependencies: [],
    caching: {
      enabled: true,
      ttl: 300,
      invalidateOn: []
    },
    security: {
      allowExternalRequests: false,
      timeout: 5000,
      maxMemoryUsage: 1024 * 1024
    },
    createdBy: 'test-user',
    createdAt: new Date(),
    isActive: true
  }
}

// Helper function to create test computation context
function createTestContext(
  targetType: 'user' | 'document' | 'collection' | 'database',
  targetId: string
): ComputationContext {
  return {
    target: null,
    targetId,
    targetType,
    database: {} as any, // Mock database
    timestamp: Date.now(),
    nodeId: 'test-node',
    customData: {}
  }
}

describe('ComputedAttributeEngine', () => {
  let engine: ComputedAttributeEngine

  beforeEach(async () => {
    engine = new ComputedAttributeEngine({
      maxConcurrentComputations: 10,
      defaultComputeTimeout: 5000,
      enableCaching: true
    })
    await engine.initialize()
  })

  afterEach(async () => {
    // Clean up if needed
  })

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newEngine = new ComputedAttributeEngine()
      await newEngine.initialize()

      const health = await newEngine.getHealthStatus()
      expect(health.healthy).toBe(true)
      expect(health.registeredAttributes).toBe(0)
    })

    test('should throw error when initializing twice', async () => {
      expect(async () => {
        await engine.initialize()
      }).toThrow()
    })
  })

  describe('Attribute Registration', () => {
    test('should register a simple attribute', async () => {
      const definition = createTestAttribute(
        'test-attr',
        'Test Attribute',
        'user',
        async (context: ComputationContext) => {
          return `Hello ${context.targetId}`
        },
        'A test computed attribute'
      )

      await engine.registerAttribute(definition)

      const retrieved = await engine.getAttributeDefinition('test-attr')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('test-attr')
      expect(retrieved?.name).toBe('Test Attribute')
    })

    test('should throw error for duplicate attribute ID', async () => {
      const definition = createTestAttribute(
        'duplicate-attr',
        'Duplicate Attribute',
        'user',
        async () => 'test'
      )

      await engine.registerAttribute(definition)

      expect(async () => {
        await engine.registerAttribute(definition)
      }).toThrow()
    })

    test('should validate attribute definition', async () => {
      const invalidDefinition = createTestAttribute(
        '', // Invalid empty ID
        'Invalid Attribute',
        'user',
        async () => 'test'
      )

      expect(async () => {
        await engine.registerAttribute(invalidDefinition)
      }).toThrow()
    })

    test('should unregister an attribute', async () => {
      const definition = createTestAttribute(
        'temp-attr',
        'Temporary Attribute',
        'user',
        async () => 'temp'
      )

      await engine.registerAttribute(definition)
      expect(await engine.getAttributeDefinition('temp-attr')).toBeDefined()

      await engine.unregisterAttribute('temp-attr')
      expect(await engine.getAttributeDefinition('temp-attr')).toBeUndefined()
    })

    test('should throw error when unregistering non-existent attribute', async () => {
      expect(async () => {
        await engine.unregisterAttribute('non-existent')
      }).toThrow()
    })
  })

  describe('Attribute Listing', () => {
    beforeEach(async () => {
      const userAttr = createTestAttribute(
        'user-attr',
        'User Attribute',
        'user',
        async () => 'user-value'
      )

      const docAttr = createTestAttribute(
        'doc-attr',
        'Document Attribute',
        'document',
        async () => 'doc-value'
      )

      await engine.registerAttribute(userAttr)
      await engine.registerAttribute(docAttr)
    })

    test('should list all attributes', async () => {
      const attributes = await engine.listAttributes()
      expect(attributes).toHaveLength(2)

      const ids = attributes.map(attr => attr.id)
      expect(ids).toContain('user-attr')
      expect(ids).toContain('doc-attr')
    })

    test('should filter attributes by target type', async () => {
      const userAttributes = await engine.listAttributes('user')
      expect(userAttributes).toHaveLength(1)
      expect(userAttributes[0].id).toBe('user-attr')

      const docAttributes = await engine.listAttributes('document')
      expect(docAttributes).toHaveLength(1)
      expect(docAttributes[0].id).toBe('doc-attr')
    })
  })

  describe('Attribute Computation', () => {
    beforeEach(async () => {
      const simpleAttr = createTestAttribute(
        'simple-attr',
        'Simple Attribute',
        'user',
        async (context: ComputationContext) => {
          return `computed-${context.targetId}`
        }
      )

      const mathAttr = createTestAttribute(
        'math-attr',
        'Math Attribute',
        'user',
        async (context: ComputationContext) => {
          return parseInt(context.targetId) * 2
        }
      )

      await engine.registerAttribute(simpleAttr)
      await engine.registerAttribute(mathAttr)
    })

    test('should compute a single attribute', async () => {
      const context = createTestContext('user', 'user-123')
      const result = await engine.computeAttribute('simple-attr', context)
      expect(result).toBe('computed-user-123')
    })

    test('should compute multiple attributes', async () => {
      const context = createTestContext('user', '5')
      const results = await engine.computeAttributes(['simple-attr', 'math-attr'], context)
      expect(results['simple-attr']).toBe('computed-5')
      expect(results['math-attr']).toBe(10)
    })

    test('should compute all attributes for target type', async () => {
      const context = createTestContext('user', '3')
      const results = await engine.computeAllAttributes('user', '3', context)
      expect(Object.keys(results)).toHaveLength(2)
      expect(results['simple-attr']).toBe('computed-3')
      expect(results['math-attr']).toBe(6)
    })

    test('should throw error for non-existent attribute', async () => {
      const context = createTestContext('user', 'user-123')
      expect(async () => {
        await engine.computeAttribute('non-existent', context)
      }).toThrow()
    })

    test('should handle computation errors gracefully', async () => {
      const errorAttr = createTestAttribute(
        'error-attr',
        'Error Attribute',
        'user',
        async () => {
          throw new Error('Computation failed')
        }
      )

      await engine.registerAttribute(errorAttr)
      const context = createTestContext('user', 'user-123')

      expect(async () => {
        await engine.computeAttribute('error-attr', context)
      }).toThrow()
    })
  })

  describe('Cache Management', () => {
    test('should get cache stats', async () => {
      const stats = await engine.getCacheStats()
      expect(stats).toBeDefined()
      expect(typeof stats.hitRate).toBe('number')
      expect(typeof stats.missRate).toBe('number')
      expect(typeof stats.memoryUsage).toBe('number')
    })

    test('should clear all cache', async () => {
      await engine.clearAllCache()
      // Should not throw error
    })

    test('should invalidate cache for specific attribute', async () => {
      await engine.invalidateCache('test-attr')
      // Should not throw error
    })

    test('should invalidate cache for specific attribute and target', async () => {
      await engine.invalidateCache('test-attr', 'target-123')
      // Should not throw error
    })
  })

  describe('Validation', () => {
    test('should validate valid definition', async () => {
      const definition = createTestAttribute(
        'valid-attr',
        'Valid Attribute',
        'user',
        async () => 'valid',
        'A valid attribute'
      )

      const result = await engine.validateDefinition(definition)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should detect invalid definition', async () => {
      const definition = createTestAttribute(
        '', // Invalid empty ID
        'Invalid Attribute',
        'user',
        async () => 'invalid'
      )

      const result = await engine.validateDefinition(definition)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('should provide warnings for missing description', async () => {
      const definition = createTestAttribute(
        'no-desc-attr',
        'No Description Attribute',
        'user',
        async () => 'no-desc',
        '' // Empty description
      )

      const result = await engine.validateDefinition(definition)
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Health Status', () => {
    test('should report healthy status', async () => {
      const health = await engine.getHealthStatus()
      expect(health.healthy).toBe(true)
      expect(typeof health.registeredAttributes).toBe('number')
      expect(typeof health.cacheSize).toBe('number')
      expect(typeof health.averageComputeTime).toBe('number')
      expect(typeof health.errorRate).toBe('number')
    })
  })

  describe('Event Handling', () => {
    test('should emit computed events', async () => {
      const definition = createTestAttribute(
        'event-attr',
        'Event Attribute',
        'user',
        async () => 'event-value'
      )

      await engine.registerAttribute(definition)

      let eventReceived = false
      engine.on('computed', (event) => {
        expect(event.attributeId).toBe('event-attr')
        expect(event.type).toBe('computed')
        eventReceived = true
      })

      const context = createTestContext('user', 'user-123')
      await engine.computeAttribute('event-attr', context)
      expect(eventReceived).toBe(true)
    })

    test('should emit error events', async () => {
      const definition = createTestAttribute(
        'error-event-attr',
        'Error Event Attribute',
        'user',
        async () => {
          throw new Error('Test error')
        }
      )

      await engine.registerAttribute(definition)

      let errorEventReceived = false
      engine.on('error', (event) => {
        expect(event.attributeId).toBe('error-event-attr')
        expect(event.type).toBe('error')
        expect(event.error).toBeDefined()
        errorEventReceived = true
      })

      const context = createTestContext('user', 'user-123')

      try {
        await engine.computeAttribute('error-event-attr', context)
      } catch {
        // Expected to throw
      }

      expect(errorEventReceived).toBe(true)
    })
  })

  describe('Configuration', () => {
    test('should use default configuration', () => {
      const defaultEngine = new ComputedAttributeEngine()
      expect(defaultEngine).toBeDefined()
    })

    test('should use custom configuration', () => {
      const customEngine = new ComputedAttributeEngine({
        maxConcurrentComputations: 50,
        defaultComputeTimeout: 10000,
        enableCaching: false
      })
      expect(customEngine).toBeDefined()
    })
  })
})