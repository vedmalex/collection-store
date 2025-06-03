import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ComputedAttributeCache } from '../cache'
import type { CacheKey, CacheConfig } from '../types/CacheTypes'

// Helper function to create test cache key
function createTestCacheKey(
  attributeId: string,
  targetId: string,
  targetType: 'user' | 'document' | 'collection' | 'database' = 'user',
  contextHash?: string
): CacheKey {
  return {
    attributeId,
    targetId,
    targetType,
    contextHash
  }
}

// Helper function to wait for a specified time
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('Day 5 Cache Implementation', () => {
  describe('ComputedAttributeCache', () => {
    let cache: ComputedAttributeCache

    beforeEach(async () => {
      cache = new ComputedAttributeCache({
        maxSize: 100,
        defaultTTL: 1, // 1 second for testing
        cleanupInterval: 0.5, // 500ms for testing
        enableMetrics: true
      })
      await cache.initialize()
    })

    afterEach(async () => {
      await cache.shutdown()
    })

    describe('Initialization and Configuration', () => {
      test('should initialize successfully', async () => {
        const newCache = new ComputedAttributeCache()
        await newCache.initialize()
        await newCache.shutdown()
      })

      test('should throw error when initializing twice', async () => {
        expect(async () => {
          await cache.initialize()
        }).toThrow()
      })

      test('should update configuration', async () => {
        const originalConfig = cache.getConfig()
        expect(originalConfig.maxSize).toBe(100)

        await cache.configure({ maxSize: 200 })
        const updatedConfig = cache.getConfig()
        expect(updatedConfig.maxSize).toBe(200)
      })

      test('should shutdown properly', async () => {
        const newCache = new ComputedAttributeCache()
        await newCache.initialize()
        await newCache.shutdown()
        // Should not throw
      })
    })

    describe('Basic Cache Operations', () => {
      test('should set and get cache values', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        const value = { data: 'test value' }

        await cache.set(key, value, 10) // 10 seconds TTL
        const cached = await cache.get(key)

        expect(cached).toBeDefined()
        expect(cached!.value).toEqual(value)
        expect(cached!.dependencies).toEqual([])
      })

      test('should return null for non-existent keys', async () => {
        const key = createTestCacheKey('nonexistent', 'target1')
        const cached = await cache.get(key)
        expect(cached).toBeNull()
      })

      test('should check if key exists', async () => {
        const key = createTestCacheKey('attr1', 'target1')

        expect(await cache.has(key)).toBe(false)

        await cache.set(key, 'test value')
        expect(await cache.has(key)).toBe(true)
      })

      test('should delete specific cache entries', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'test value')

        expect(await cache.has(key)).toBe(true)

        const deleted = await cache.delete(key)
        expect(deleted).toBe(true)
        expect(await cache.has(key)).toBe(false)
      })

      test('should clear all cache', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')

        await cache.clear()

        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(false)
      })
    })

    describe('TTL and Expiration', () => {
      test('should expire entries after TTL', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'test value', 0.1) // 100ms TTL

        expect(await cache.has(key)).toBe(true)

        await wait(150) // Wait for expiration

        expect(await cache.has(key)).toBe(false)
        expect(await cache.get(key)).toBeNull()
      })

      test('should use default TTL when not specified', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'test value') // Uses default TTL (1 second)

        expect(await cache.has(key)).toBe(true)

        await wait(1100) // Wait for default TTL expiration

        expect(await cache.has(key)).toBe(false)
      })

      test('should handle different TTL values', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1', 0.1) // 100ms
        await cache.set(key2, 'value2', 0.3) // 300ms

        await wait(150)
        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(true)

        await wait(200)
        expect(await cache.has(key2)).toBe(false)
      })
    })

    describe('Dependencies and Invalidation', () => {
      test('should store and retrieve dependencies', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        const dependencies = ['dep1', 'dep2', 'dep3']

        await cache.set(key, 'test value', 10, dependencies)
        const cached = await cache.get(key)

        expect(cached!.dependencies).toEqual(dependencies)
      })

      test('should invalidate by attribute ID', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr1', 'target2')
        const key3 = createTestCacheKey('attr2', 'target1')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')
        await cache.set(key3, 'value3')

        const invalidated = await cache.invalidateByAttribute('attr1')
        expect(invalidated).toBe(2)

        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(false)
        expect(await cache.has(key3)).toBe(true)
      })

      test('should invalidate by attribute ID and target ID', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr1', 'target2')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')

        const invalidated = await cache.invalidateByAttribute('attr1', 'target1')
        expect(invalidated).toBe(1)

        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(true)
      })

      test('should invalidate by dependency', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')
        const key3 = createTestCacheKey('attr3', 'target3')

        await cache.set(key1, 'value1', 10, ['dep1', 'dep2'])
        await cache.set(key2, 'value2', 10, ['dep2', 'dep3'])
        await cache.set(key3, 'value3', 10, ['dep3', 'dep4'])

        const invalidated = await cache.invalidateByDependency('dep2')
        expect(invalidated).toBe(2)

        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(false)
        expect(await cache.has(key3)).toBe(true)
      })

      test('should invalidate by target', async () => {
        const key1 = createTestCacheKey('attr1', 'target1', 'user')
        const key2 = createTestCacheKey('attr2', 'target1', 'user')
        const key3 = createTestCacheKey('attr1', 'target2', 'user')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')
        await cache.set(key3, 'value3')

        const invalidated = await cache.invalidateByTarget('user', 'target1')
        expect(invalidated).toBe(2)

        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(false)
        expect(await cache.has(key3)).toBe(true)
      })
    })

    describe('Cache Management and Cleanup', () => {
      test('should perform cleanup of expired entries', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1', 0.1) // 100ms TTL
        await cache.set(key2, 'value2', 10) // 10s TTL

        await wait(150) // Wait for first entry to expire

        const result = await cache.cleanup()
        expect(result.removedExpired).toBe(1)
        expect(result.totalRemoved).toBe(1)

        expect(await cache.has(key1)).toBe(false)
        expect(await cache.has(key2)).toBe(true)
      })

      test('should compact cache and free memory', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1', 0.1) // Will expire
        await cache.set(key2, 'value2', 10) // Will remain

        await wait(150) // Wait for expiration

        const result = await cache.compact()
        expect(result.beforeSize).toBe(2)
        expect(result.afterSize).toBe(1)
        expect(result.memoryFreed).toBeGreaterThan(0)
      })

      test('should handle cache size limits with eviction', async () => {
        // Create cache with small size limit
        const smallCache = new ComputedAttributeCache({
          maxSize: 2,
          defaultTTL: 10
        })
        await smallCache.initialize()

        try {
          const keys = [
            createTestCacheKey('attr1', 'target1'),
            createTestCacheKey('attr2', 'target2'),
            createTestCacheKey('attr3', 'target3')
          ]

          // Fill cache to limit
          await smallCache.set(keys[0], 'value1')
          await smallCache.set(keys[1], 'value2')

          // Cache should be at limit (2 entries)
          expect(await smallCache.has(keys[0])).toBe(true)
          expect(await smallCache.has(keys[1])).toBe(true)

          // Add one more entry, should trigger eviction
          await smallCache.set(keys[2], 'value3')

          // Cache should still have only 2 entries, one should be evicted
          const remainingKeys = await smallCache.getKeys()
          expect(remainingKeys).toHaveLength(2)

          // The new entry should definitely be there
          expect(await smallCache.has(keys[2])).toBe(true)
        } finally {
          await smallCache.shutdown()
        }
      })
    })

    describe('Statistics and Monitoring', () => {
      test('should provide cache statistics', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')

        const stats = await cache.getStats()
        expect(stats.totalAttributes).toBe(2)
        expect(stats.cachedAttributes).toBe(2)
        expect(stats.cacheSize).toBe(2)
        expect(stats.memoryUsage).toBeGreaterThan(0)
        expect(stats.hitRate).toBeGreaterThanOrEqual(0)
        expect(stats.missRate).toBeGreaterThanOrEqual(0)
      })

      test('should provide health status', async () => {
        const health = await cache.getHealth()
        expect(health.healthy).toBeDefined()
        expect(health.memoryUsage).toBeGreaterThanOrEqual(0)
        expect(health.hitRate).toBeGreaterThanOrEqual(0)
        expect(health.errorRate).toBeGreaterThanOrEqual(0)
        expect(Array.isArray(health.issues)).toBe(true)
        expect(Array.isArray(health.recommendations)).toBe(true)
      })

      test('should track operation results', async () => {
        const key = createTestCacheKey('attr1', 'target1')

        await cache.set(key, 'value1')
        let lastOp = cache.getLastOperationResult()
        expect(lastOp?.operation).toBe('set')
        expect(lastOp?.success).toBe(true)

        await cache.get(key)
        lastOp = cache.getLastOperationResult()
        expect(lastOp?.operation).toBe('get')
        expect(lastOp?.success).toBe(true)
        expect(lastOp?.hit).toBe(true)
      })
    })

    describe('Advanced Features', () => {
      test('should get all cache keys', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')

        const keys = await cache.getKeys()
        expect(keys).toHaveLength(2)
        expect(keys.some(k => k.includes('attr1'))).toBe(true)
        expect(keys.some(k => k.includes('attr2'))).toBe(true)
      })

      test('should filter keys by pattern', async () => {
        const key1 = createTestCacheKey('user-attr', 'target1')
        const key2 = createTestCacheKey('doc-attr', 'target2')

        await cache.set(key1, 'value1')
        await cache.set(key2, 'value2')

        const userKeys = await cache.getKeys('user-attr')
        expect(userKeys).toHaveLength(1)
        expect(userKeys[0]).toContain('user-attr')
      })

      test('should inspect cache entries', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        const value = { data: 'test' }
        const dependencies = ['dep1', 'dep2']

        await cache.set(key, value, 10, dependencies)

        const inspection = await cache.inspect(key)
        expect(inspection.exists).toBe(true)
        expect(inspection.value).toEqual(value)
        expect(inspection.metadata?.dependencies).toEqual(dependencies)
        expect(inspection.size).toBeGreaterThan(0)
      })

      test('should export and import cache data', async () => {
        const key1 = createTestCacheKey('attr1', 'target1')
        const key2 = createTestCacheKey('attr2', 'target2')

        await cache.set(key1, 'value1', 100) // Long TTL
        await cache.set(key2, 'value2', 100)

        const exported = await cache.export()
        expect(exported.version).toBe('1.0.0')
        expect(exported.entries).toHaveLength(2)

        // Clear cache and import
        await cache.clear()
        expect(await cache.has(key1)).toBe(false)

        const importResult = await cache.import(exported)
        expect(importResult.imported).toBe(2)
        expect(importResult.skipped).toBe(0)
        expect(importResult.errors).toBe(0)

        expect(await cache.has(key1)).toBe(true)
        expect(await cache.has(key2)).toBe(true)
      })

      test('should skip expired entries during import', async () => {
        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'value1', 0.1) // Short TTL

        const exported = await cache.export()
        await wait(150) // Wait for expiration

        await cache.clear()
        const importResult = await cache.import(exported)

        expect(importResult.imported).toBe(0)
        expect(importResult.skipped).toBe(1)
      })
    })

    describe('Event Handling', () => {
      test('should emit cache hit events', async () => {
        let hitEventReceived = false
        cache.on('hit', (event) => {
          expect(event.type).toBe('hit')
          expect(event.key.attributeId).toBe('attr1')
          hitEventReceived = true
        })

        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'value1')
        await cache.get(key)

        expect(hitEventReceived).toBe(true)
      })

      test('should emit cache miss events', async () => {
        let missEventReceived = false
        cache.on('miss', (event) => {
          expect(event.type).toBe('miss')
          expect(event.key.attributeId).toBe('nonexistent')
          missEventReceived = true
        })

        const key = createTestCacheKey('nonexistent', 'target1')
        await cache.get(key)

        expect(missEventReceived).toBe(true)
      })

      test('should emit set events', async () => {
        let setEventReceived = false
        cache.on('set', (event) => {
          expect(event.type).toBe('set')
          expect(event.key.attributeId).toBe('attr1')
          setEventReceived = true
        })

        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'value1')

        expect(setEventReceived).toBe(true)
      })

      test('should emit invalidated events', async () => {
        let invalidatedEventReceived = false
        cache.on('invalidated', (event) => {
          expect(event.type).toBe('invalidated')
          expect(event.key.attributeId).toBe('attr1')
          invalidatedEventReceived = true
        })

        const key = createTestCacheKey('attr1', 'target1')
        await cache.set(key, 'value1')
        await cache.delete(key)

        expect(invalidatedEventReceived).toBe(true)
      })
    })

    describe('Error Handling', () => {
      test('should handle initialization errors', async () => {
        const newCache = new ComputedAttributeCache()
        await newCache.initialize()

        expect(async () => {
          await newCache.initialize()
        }).toThrow()

        await newCache.shutdown()
      })

      test('should handle invalid cache operations gracefully', async () => {
        const key = createTestCacheKey('attr1', 'target1')

        // Should not throw for non-existent key deletion
        const deleted = await cache.delete(key)
        expect(deleted).toBe(false)
      })
    })
  })
})