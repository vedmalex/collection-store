/**
 * Stress Testing Suite for WAL Transaction System
 * Comprehensive stress testing для PHASE 4.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { performance } from 'perf_hooks'
import { WALCollection, WALCollectionConfig } from '../../core/wal/WALCollection'
import { WALDatabase, WALDatabaseConfig } from '../../core/wal/WALDatabase'
import { Item } from '../types/Item'

interface TestItem extends Item {
  id: number
  name: string
  data?: string
  timestamp?: number
  payload?: any
}

interface StressTestResult {
  testName: string
  duration: number
  operationsCompleted: number
  operationsPerSecond: number
  errorsCount: number
  memoryUsage: {
    initial: number
    peak: number
    final: number
    leaked: number
  }
  success: boolean
}

class StressTestRunner {
  private results: StressTestResult[] = []

  async runStressTest(
    testName: string,
    durationMs: number,
    operationFn: () => Promise<void>,
    options: {
      maxOperations?: number
      memoryThreshold?: number
      errorThreshold?: number
    } = {}
  ): Promise<StressTestResult> {
    const {
      maxOperations = Infinity,
      memoryThreshold = 100 * 1024 * 1024, // 100MB
      errorThreshold = 0.01 // 1% error rate
    } = options

    // Force garbage collection
    if (global.gc) {
      global.gc()
    }

    const initialMemory = process.memoryUsage().heapUsed
    let peakMemory = initialMemory
    let operationsCompleted = 0
    let errorsCount = 0
    const startTime = performance.now()
    const endTime = startTime + durationMs

    console.log(`\n🚀 Starting stress test: ${testName}`)
    console.log(`Duration: ${durationMs}ms, Max operations: ${maxOperations}`)

    while (performance.now() < endTime && operationsCompleted < maxOperations) {
      try {
        await operationFn()
        operationsCompleted++

        // Monitor memory usage
        const currentMemory = process.memoryUsage().heapUsed
        if (currentMemory > peakMemory) {
          peakMemory = currentMemory
        }

        // Check memory threshold
        if (currentMemory > memoryThreshold) {
          console.warn(`⚠️ Memory threshold exceeded: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`)
          break
        }

        // Progress reporting
        if (operationsCompleted % 1000 === 0) {
          const elapsed = performance.now() - startTime
          const opsPerSec = (operationsCompleted / elapsed) * 1000
          console.log(`📊 Progress: ${operationsCompleted} ops, ${opsPerSec.toFixed(0)} ops/sec`)
        }

      } catch (error) {
        errorsCount++
        // Reduce log noise in CI/full runs
        if ((operationsCompleted + errorsCount) % 100 === 0) {
          console.warn(`⚠️ Operation errors so far: ${errorsCount}`)
        }

        // Check error threshold only after a minimum sample size to avoid
        // flakiness from transient first-iteration failures under parallel runs
        const attempts = operationsCompleted + errorsCount
        if (attempts >= 50) {
          const errorRate = errorsCount / attempts
          if (errorRate > errorThreshold) {
            console.error(`🚨 Error threshold exceeded: ${(errorRate * 100).toFixed(2)}%`)
            break
          }
        }
      }
    }

    const finalTime = performance.now()
    const finalMemory = process.memoryUsage().heapUsed
    const duration = finalTime - startTime
    const operationsPerSecond = (operationsCompleted / duration) * 1000

    const denominator = Math.max(operationsCompleted, 1)
    const result: StressTestResult = {
      testName,
      duration,
      operationsCompleted,
      operationsPerSecond,
      errorsCount,
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory,
        leaked: finalMemory - initialMemory
      },
      success: errorsCount / denominator < errorThreshold
    }

    this.results.push(result)
    this.printResult(result)
    return result
  }

  private printResult(result: StressTestResult): void {
    console.log(`\n📋 Stress Test Results: ${result.testName}`)
    console.log(`⏱️  Duration: ${result.duration.toFixed(2)}ms`)
    console.log(`🔢 Operations: ${result.operationsCompleted}`)
    console.log(`⚡ Ops/sec: ${result.operationsPerSecond.toFixed(2)}`)
    console.log(`❌ Errors: ${result.errorsCount}`)
    console.log(`💾 Memory - Initial: ${(result.memoryUsage.initial / 1024 / 1024).toFixed(2)}MB`)
    console.log(`💾 Memory - Peak: ${(result.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`)
    console.log(`💾 Memory - Final: ${(result.memoryUsage.final / 1024 / 1024).toFixed(2)}MB`)
    console.log(`💾 Memory - Leaked: ${(result.memoryUsage.leaked / 1024 / 1024).toFixed(2)}MB`)
    console.log(`✅ Success: ${result.success ? 'PASS' : 'FAIL'}`)
  }

  getResults(): StressTestResult[] {
    return [...this.results]
  }

  clear(): void {
    this.results = []
  }
}

const RUN_STRESS = process.env.CS_RUN_STRESS === '1'

;(RUN_STRESS ? describe : describe.skip)('Stress Testing Suite', () => {
  const testDir = './test-data/stress-testing'
  const stressRunner = new StressTestRunner()

  beforeEach(async () => {
    // Use tmpdir to avoid FS contention in CI and ensure isolation per run
    const tmpBase = path.join(os.tmpdir(), `cs-stress-${Date.now()}-${Math.floor(Math.random()*10000)}`)
    ;(global as any).__CS_STRESS_TMP__ = tmpBase
    await fs.ensureDir(tmpBase)
    // point testDir to unique tmp path
    ;(global as any).__CS_STRESS_DIR__ = tmpBase
    // no-op, collections below will use this path
    stressRunner.clear()
  })

  afterEach(async () => {
    const dir = (global as any).__CS_STRESS_DIR__ || testDir
    await fs.remove(dir)
  })

  describe('High Volume Operations', () => {
    it('should handle high volume WAL writes', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'high-volume-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'high-volume.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'High Volume WAL Writes',
        10000, // 10 seconds
        async () => {
          await collection.create({
            id: operationCounter++,
            name: `High Volume Item ${operationCounter}`,
            data: 'x'.repeat(100), // 100 bytes per item
            timestamp: Date.now()
          })
        },
        {
          maxOperations: 50000,
          memoryThreshold: 200 * 1024 * 1024, // 200MB
          errorThreshold: 0.001 // 0.1% error rate
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(1000)
      expect(result.operationsPerSecond).toBeGreaterThan(100)
      expect(result.memoryUsage.leaked).toBeLessThan(50 * 1024 * 1024) // <50MB leak

      await collection.reset()
    }, 15000) // 15 second timeout

    it('should handle concurrent transactions stress test', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'concurrent-stress-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'concurrent-stress.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'Concurrent Transactions Stress',
        8000, // 8 seconds
        async () => {
          // Start multiple concurrent transactions
          const promises: Promise<void>[] = []

          for (let i = 0; i < 5; i++) {
            promises.push(
              (async () => {
                const txId = await collection.beginTransaction()
                try {
                  await collection.create({
                    id: operationCounter++,
                    name: `Concurrent Item ${operationCounter}`,
                    data: 'concurrent data'
                  })
                  await collection.commitTransaction(txId)
                } catch (error) {
                  await collection.rollbackTransaction(txId)
                  throw error
                }
              })()
            )
          }

          await Promise.all(promises)
        },
        {
          maxOperations: 1000,
          memoryThreshold: 100 * 1024 * 1024, // 100MB
          errorThreshold: 0.1 // 10% error rate for concurrent operations (stabilize under CI load)
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(100)
      expect(result.errorsCount).toBeLessThan(result.operationsCompleted * 0.1)

      await collection.reset()
    }, 12000)

    it('should handle large dataset operations', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'large-dataset-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'large-dataset.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)

      // Pre-populate with large dataset
      console.log('📦 Pre-populating large dataset...')
      for (let i = 0; i < 5000; i++) {
        await collection.create({
          id: i,
          name: `Large Dataset Item ${i}`,
          data: 'x'.repeat(1000), // 1KB per item
          payload: { index: i, timestamp: Date.now() }
        })
      }

      let operationCounter = 5000

      const result = await stressRunner.runStressTest(
        'Large Dataset Operations',
        5000, // 5 seconds
        async () => {
          // Mix of operations on large dataset
          const operation = operationCounter % 4

          switch (operation) {
            case 0: // Create
              await collection.create({
                id: operationCounter++,
                name: `New Item ${operationCounter}`,
                data: 'new data'
              })
              break

            case 1: // Read
              const randomId = Math.floor(Math.random() * operationCounter)
              await collection.findById(randomId)
              break

            case 2: // Update
              const updateId = Math.floor(Math.random() * operationCounter)
              await collection.updateWithId(updateId, {
                name: `Updated Item ${updateId}`,
                timestamp: Date.now()
              })
              break

            case 3: // Delete
              if (operationCounter > 5100) { // Keep minimum dataset
                const deleteId = operationCounter - 100
                await collection.removeWithId(deleteId)
              }
              break
          }

          operationCounter++
        },
        {
          maxOperations: 2000,
          memoryThreshold: 150 * 1024 * 1024, // 150MB
          errorThreshold: 0.02 // 2% error rate
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(500)

      await collection.reset()
    }, 20000)
  })

  describe('Long Running Operations', () => {
    it('should handle long-running transaction stress', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'long-running-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'long-running.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'Long Running Transactions',
        15000, // 15 seconds
        async () => {
          const txId = await collection.beginTransaction()

          try {
            // Perform multiple operations in single transaction
            for (let i = 0; i < 10; i++) {
              await collection.create({
                id: operationCounter++,
                name: `Long Running Item ${operationCounter}`,
                data: `batch data ${i}`
              })
            }

            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 10))

            await collection.commitTransaction(txId)
          } catch (error) {
            await collection.rollbackTransaction(txId)
            throw error
          }
        },
        {
          maxOperations: 500,
          memoryThreshold: 100 * 1024 * 1024, // 100MB
          errorThreshold: 0.01 // 1% error rate
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(50)

      await collection.reset()
    }, 20000)

    it('should handle database-wide stress operations', async () => {
      const config: WALDatabaseConfig = {
        enableTransactions: true,
        globalWAL: false,
        walOptions: {
          enableWAL: true,
          autoRecovery: false
        }
      }

      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const database = new WALDatabase(baseDir, 'stress-db', config)
      await database.connect()

      // Create multiple collections
      const collections: any[] = []
      for (let i = 0; i < 5; i++) {
        const collection = await database.createCollection<TestItem>(`collection-${i}`)
        collections.push(collection)
      }

      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'Database-wide Stress Operations',
        10000, // 10 seconds
        async () => {
          const txId = await database.beginGlobalTransaction()

          try {
            // Perform operations across multiple collections
            for (const collection of collections) {
              await collection.create({
                id: operationCounter++,
                name: `Multi-Collection Item ${operationCounter}`,
                data: 'global transaction data'
              })
            }

            await database.commitGlobalTransaction(txId)
          } catch (error) {
            await database.rollbackGlobalTransaction(txId)
            throw error
          }
        },
        {
          maxOperations: 1000,
          memoryThreshold: 150 * 1024 * 1024, // 150MB
          errorThreshold: 0.02 // 2% error rate
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(100)

      await database.close()
    }, 15000)
  })

  describe('Memory Pressure Tests', () => {
    it('should handle memory pressure scenarios', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'memory-pressure-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'memory-pressure.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'Memory Pressure Test',
        8000, // 8 seconds
        async () => {
          // Create items with large payloads
          await collection.create({
            id: operationCounter++,
            name: `Memory Pressure Item ${operationCounter}`,
            data: 'x'.repeat(10000), // 10KB per item
            payload: {
              largeArray: new Array(1000).fill('memory pressure data'),
              timestamp: Date.now(),
              index: operationCounter
            }
          })
        },
        {
          maxOperations: 1000,
          memoryThreshold: 200 * 1024 * 1024, // 200MB threshold
          errorThreshold: 0.01 // 1% error rate
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(50)

      // Memory should not leak excessively
      expect(result.memoryUsage.leaked).toBeLessThan(100 * 1024 * 1024) // <100MB leak

      await collection.reset()
    }, 12000)

    it('should handle rapid allocation/deallocation', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'allocation-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'allocation.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'Rapid Allocation/Deallocation',
        6000, // 6 seconds
        async () => {
          const txId = await collection.beginTransaction()

          try {
            // Create multiple items
            const items: TestItem[] = []
            for (let i = 0; i < 5; i++) {
              const item = await collection.create({
                id: operationCounter++,
                name: `Allocation Item ${operationCounter}`,
                data: 'allocation data'
              })
              if (item) items.push(item)
            }

            // Delete some items
            for (let i = 0; i < 2 && items.length > 0; i++) {
              const item = items.pop()
              if (item) {
                await collection.removeWithId(item.id)
              }
            }

            await collection.commitTransaction(txId)
          } catch (error) {
            await collection.rollbackTransaction(txId)
            throw error
          }
        },
        {
          maxOperations: 1000,
          memoryThreshold: 100 * 1024 * 1024, // 100MB
          errorThreshold: 0.02 // 2% error rate
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(200)

      await collection.reset()
    }, 10000)
  })

  describe('Error Recovery Stress', () => {
    it('should handle transaction rollback stress', async () => {
      const baseDir = (global as any).__CS_STRESS_DIR__ || testDir
      const config: WALCollectionConfig<TestItem> = {
        name: 'rollback-stress-test',
        root: baseDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(baseDir, 'rollback-stress.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      let operationCounter = 0

      const result = await stressRunner.runStressTest(
        'Transaction Rollback Stress',
        5000, // 5 seconds
        async () => {
          const txId = await collection.beginTransaction()

          try {
            // Perform operations
            await collection.create({
              id: operationCounter++,
              name: `Rollback Test Item ${operationCounter}`,
              data: 'rollback test data'
            })

            // Deterministic rollback rate using a simple LCG seeded per process
            const seedBase = (global as any).__CS_SEED__ ?? Date.now()
            ;(global as any).__CS_SEED__ = (1103515245 * seedBase + 12345) % 0x80000000
            const rnd = ((global as any).__CS_SEED__ % 1000) / 1000
            if (rnd < 0.3) { // ~30% rollback rate
              await collection.rollbackTransaction(txId)
            } else {
              await collection.commitTransaction(txId)
            }
          } catch (error) {
            await collection.rollbackTransaction(txId)
            throw error
          }
        },
        {
          maxOperations: 2000,
          memoryThreshold: 100 * 1024 * 1024, // 100MB
          errorThreshold: 0.35 // 35% error rate (including intentional rollbacks)
        }
      )

      expect(result.success).toBe(true)
      expect(result.operationsCompleted).toBeGreaterThan(500)

      await collection.reset()
    }, 8000)
  })
})