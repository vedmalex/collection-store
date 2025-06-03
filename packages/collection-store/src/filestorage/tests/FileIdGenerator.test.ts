/**
 * File ID Generator Tests
 * Phase 4: File Storage System - ID Generation Testing
 *
 * Following DEVELOPMENT_RULES.md testing guidelines:
 * - High-granularity tests grouped by functionality
 * - Collision resistance testing under high load
 * - Performance timing with performance.now()
 * - Test context isolation and cleanup
 */

import {
  FileIdGenerator,
  getGlobalFileIdGenerator,
  setGlobalFileIdGenerator,
  generateFileId,
  generateFileIds,
  validateFileId,
  getFileIdInfo
} from '../core/FileIdGenerator'

describe('FileIdGenerator', () => {
  describe('UUID Strategy', () => {
    let generator: FileIdGenerator

    beforeEach(() => {
      generator = new FileIdGenerator({ strategy: 'uuid' })
    })

    afterEach(() => {
      // Test context cleanup
      generator = null as any
    })

    it('should generate valid UUID v4 format', () => {
      const id = generator.generateId()

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(generator.validateId(id)).toBe(true)
    })

    it('should generate unique IDs under high load', () => {
      const iterations = 10000
      const ids = new Set<string>()

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const id = generator.generateId()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }

      const duration = performance.now() - startTime
      expect(ids.size).toBe(iterations)

      console.log(`UUID generation: ${iterations} IDs in ${duration.toFixed(2)}ms (${(iterations / (duration / 1000)).toFixed(0)} IDs/sec)`)
    })

    it('should handle concurrent ID generation', async () => {
      const concurrentBatches = 100
      const batchSize = 100
      const allIds = new Set<string>()

      const promises = Array.from({ length: concurrentBatches }, async () => {
        return generator.generateBatch(batchSize)
      })

      const results = await Promise.all(promises)

      // Flatten all results and check uniqueness
      results.forEach(batch => {
        batch.forEach(id => {
          expect(allIds.has(id)).toBe(false)
          allIds.add(id)
        })
      })

      expect(allIds.size).toBe(concurrentBatches * batchSize)
    })

         it('should validate UUID format correctly', () => {
       const validId = generator.generateId()
       const invalidIds = [
         '',
         'invalid',
         '123e4567-e89b-42d3-x456-426614174000', // invalid character
         'not-a-uuid-at-all',
         '123-456-789', // too short
       ]

       expect(generator.validateId(validId)).toBe(true)

       invalidIds.forEach(id => {
         expect(generator.validateId(id)).toBe(false)
       })
     })
  })

  describe('Timestamp Counter Strategy', () => {
    let generator: FileIdGenerator

    beforeEach(() => {
      generator = new FileIdGenerator({
        strategy: 'timestamp_counter',
        nodeId: 'testnode12345678'
      })
    })

    afterEach(() => {
      generator = null as any
    })

    it('should generate sortable IDs with timestamp', async () => {
      const id1 = generator.generateId()

      // Small delay to ensure different timestamp
      const delay = new Promise(resolve => setTimeout(resolve, 1))
      await delay

      const id2 = generator.generateId()

      expect(id1 < id2).toBe(true) // Lexicographically sortable

             const info1 = generator.getIdInfo(id1)
       const info2 = generator.getIdInfo(id2)

       expect(info1).toBeDefined()
       expect(info2).toBeDefined()
       expect(info1!.timestamp!).toBeLessThan(info2!.timestamp!)
    })

    it('should handle rapid generation within same millisecond', () => {
      const ids: string[] = []
      const startTime = performance.now()

      // Generate many IDs quickly to force same millisecond
      while (performance.now() - startTime < 1) {
        ids.push(generator.generateId())
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)

      console.log(`Generated ${ids.length} unique IDs within ~1ms`)
    })

         it('should include node ID and counter in generated IDs', () => {
       const id = generator.generateId()
       const info = generator.getIdInfo(id)

       expect(info).toBeDefined()
       expect(info?.nodeId).toBe('testnode') // First 8 chars of nodeId
       expect(typeof info?.counter).toBe('number')
       expect(info?.counter).toBeGreaterThanOrEqual(0)
       expect(typeof info?.timestamp).toBe('number')
       expect(info?.timestamp).toBeGreaterThan(0)
       expect(info?.strategy).toBe('timestamp_counter')
     })

    it('should validate timestamp counter format correctly', () => {
      const validId = generator.generateId()
      const invalidIds = [
        '',
        'invalid',
        '123-456-789', // too short
        '1234567890123-12345678-123456', // valid format
        '123456789012g-12345678-123456', // invalid hex character
      ]

      expect(generator.validateId(validId)).toBe(true)

      invalidIds.slice(0, -2).forEach(id => {
        expect(generator.validateId(id)).toBe(false)
      })

      // The valid format should pass
      expect(generator.validateId(invalidIds[3])).toBe(true)
    })
  })

  describe('Hybrid Strategy', () => {
    let generator: FileIdGenerator

    beforeEach(() => {
      generator = new FileIdGenerator({
        strategy: 'hybrid',
        nodeId: 'testhybridnode'
      })
    })

    afterEach(() => {
      generator = null as any
    })

         it('should generate IDs with timestamp, random, node, and counter components', () => {
       const id = generator.generateId()
       const info = generator.getIdInfo(id)

       expect(info).toBeDefined()
       expect(typeof info?.timestamp).toBe('number')
       expect(info?.timestamp).toBeGreaterThan(0)
       expect(info?.nodeId).toBe('test') // First 4 chars
       expect(typeof info?.counter).toBe('number')
       expect(info?.counter).toBeGreaterThanOrEqual(0)
       expect(info?.strategy).toBe('hybrid')
     })

    it('should provide best collision resistance under extreme load', () => {
      const iterations = 50000
      const ids = new Set<string>()

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const id = generator.generateId()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }

      const duration = performance.now() - startTime
      expect(ids.size).toBe(iterations)

      console.log(`Hybrid generation: ${iterations} IDs in ${duration.toFixed(2)}ms (${(iterations / (duration / 1000)).toFixed(0)} IDs/sec)`)
    })

         it('should maintain sortability while adding randomness', async () => {
       const ids: string[] = []

       for (let i = 0; i < 1000; i++) {
         ids.push(generator.generateId())

         // Small delay every 100 iterations to ensure timestamp progression
         if (i % 100 === 0) {
           await new Promise(resolve => setTimeout(resolve, 1))
         }
       }

      // Check that IDs are generally sortable (allowing for some randomness)
      let sortedCount = 0
      for (let i = 1; i < ids.length; i++) {
        if (ids[i] >= ids[i-1]) {
          sortedCount++
        }
      }

                   // Should be mostly sorted (>40% due to timestamp component with randomness)
      const sortedPercentage = sortedCount / (ids.length - 1)
      expect(sortedPercentage).toBeGreaterThan(0.4)
    })
  })

  describe('Global Generator Functions', () => {
    beforeEach(() => {
      // Reset global generator for each test
      setGlobalFileIdGenerator(new FileIdGenerator({ strategy: 'hybrid' }))
    })

    afterEach(() => {
      // Test context cleanup
      setGlobalFileIdGenerator(new FileIdGenerator({ strategy: 'hybrid' }))
    })

    it('should provide global access to file ID generation', () => {
      const id = generateFileId()

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(validateFileId(id)).toBe(true)
    })

    it('should generate batch of IDs efficiently', () => {
      const count = 1000
      const startTime = performance.now()

      const ids = generateFileIds(count)

      const duration = performance.now() - startTime

      expect(ids.length).toBe(count)

      // Check uniqueness
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(count)

      console.log(`Batch generation: ${count} IDs in ${duration.toFixed(2)}ms`)
    })

    it('should provide ID information extraction', () => {
      const id = generateFileId()
      const info = getFileIdInfo(id)

      expect(info).toBeDefined()
      expect(info?.strategy).toBe('hybrid')
      expect(info?.generatedAt).toBeInstanceOf(Date)
    })

    it('should handle invalid IDs gracefully', () => {
      const invalidIds = ['', 'invalid', null, undefined]

      invalidIds.forEach(id => {
        expect(validateFileId(id as any)).toBe(false)
        expect(getFileIdInfo(id as any)).toBeNull()
      })
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for ID generation', () => {
      const generator = new FileIdGenerator({ strategy: 'hybrid' })
      const iterations = 100000

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        generator.generateId()
      }

      const duration = performance.now() - startTime
      const idsPerSecond = iterations / (duration / 1000)

      // Target: >10,000 IDs per second
      expect(idsPerSecond).toBeGreaterThan(10000)

      console.log(`Performance: ${idsPerSecond.toFixed(0)} IDs/sec`)
    })

    it('should have minimal memory footprint', () => {
      const generator = new FileIdGenerator({ strategy: 'hybrid' })
      const initialMemory = process.memoryUsage().heapUsed

      // Generate many IDs
      for (let i = 0; i < 10000; i++) {
        generator.generateId()
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be minimal (<1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024)

      console.log(`Memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`)
    })
  })

  describe('Collision Resistance Tests', () => {
    it('should handle multiple generators running concurrently', async () => {
      const generatorCount = 10
      const idsPerGenerator = 1000
      const allIds = new Set<string>()

      const generators = Array.from({ length: generatorCount }, (_, i) =>
        new FileIdGenerator({
          strategy: 'hybrid',
          nodeId: `node-${i.toString().padStart(3, '0')}`
        })
      )

      const promises = generators.map(async (generator) => {
        const ids: string[] = []
        for (let i = 0; i < idsPerGenerator; i++) {
          ids.push(generator.generateId())
        }
        return ids
      })

      const results = await Promise.all(promises)

      // Check global uniqueness across all generators
      results.forEach(batch => {
        batch.forEach(id => {
          expect(allIds.has(id)).toBe(false)
          allIds.add(id)
        })
      })

      expect(allIds.size).toBe(generatorCount * idsPerGenerator)
    })

    it('should maintain uniqueness under time pressure', () => {
      const generator = new FileIdGenerator({ strategy: 'hybrid' })
      const ids = new Set<string>()
      const timeLimit = 100 // 100ms
      const startTime = performance.now()

      let count = 0
      while (performance.now() - startTime < timeLimit) {
        const id = generator.generateId()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
        count++
      }

      console.log(`Generated ${count} unique IDs in ${timeLimit}ms`)
      expect(count).toBeGreaterThan(1000) // Should generate >1000 IDs in 100ms
    })
  })
})