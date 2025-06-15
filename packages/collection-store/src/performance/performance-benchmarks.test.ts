/**
 * Performance Benchmarks for WAL Transaction System
 * Comprehensive performance testing suite для PHASE 4.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { performance } from 'perf_hooks'
import { WALCollection, WALCollectionConfig } from '../core/wal/WALCollection'
import { WALDatabase, WALDatabaseConfig } from '../core/wal/WALDatabase'
import { FileWALManager } from '../wal/FileWALManager'
import { MemoryWALManager } from '../wal/MemoryWALManager'
import { Item } from '../types/Item'

interface TestItem extends Item {
  id: number
  name: string
  data?: string
  timestamp?: number
}

interface BenchmarkResult {
  operation: string
  totalTime: number
  operationsCount: number
  opsPerSecond: number
  avgLatency: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = []

  async measureOperation<T>(
    operation: string,
    operationsCount: number,
    fn: () => Promise<T>
  ): Promise<BenchmarkResult> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    const startMemory = process.memoryUsage()
    const startTime = performance.now()

    for (let i = 0; i < operationsCount; i++) {
      await fn()
    }

    const endTime = performance.now()
    const endMemory = process.memoryUsage()

    const totalTime = endTime - startTime
    const opsPerSecond = (operationsCount / totalTime) * 1000
    const avgLatency = totalTime / operationsCount

    const result: BenchmarkResult = {
      operation,
      totalTime,
      operationsCount,
      opsPerSecond,
      avgLatency,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      }
    }

    this.results.push(result)
    return result
  }

  getResults(): BenchmarkResult[] {
    return [...this.results]
  }

  printResults(): void {
    console.log('\n=== PERFORMANCE BENCHMARK RESULTS ===')
    this.results.forEach(result => {
      console.log(`\n${result.operation}:`)
      console.log(`  Total Time: ${result.totalTime.toFixed(2)}ms`)
      console.log(`  Operations: ${result.operationsCount}`)
      console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(2)}`)
      console.log(`  Avg Latency: ${result.avgLatency.toFixed(4)}ms`)
      console.log(`  Memory Delta: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`)
    })
    console.log('\n=====================================\n')
  }

  clear(): void {
    this.results = []
  }
}

describe('Performance Benchmarks', () => {
  const testDir = './test-data/performance-benchmarks'
  const benchmark = new PerformanceBenchmark()

  // Global counter to ensure unique IDs across all tests
  let globalIdCounter = 0

  beforeEach(async () => {
    await fs.ensureDir(testDir)
    benchmark.clear()
  })

  afterEach(async () => {
    await fs.remove(testDir)
    benchmark.printResults()
  })

  describe('WAL Manager Performance', () => {
    it('should benchmark FileWALManager write performance', async () => {
      const walPath = path.join(testDir, 'file-wal-write.log')
      const walManager = new FileWALManager({ walPath })

      const result = await benchmark.measureOperation(
        'FileWALManager Write Operations',
        1000,
        async () => {
          await walManager.writeEntry({
            transactionId: 'tx-' + Math.random(),
            sequenceNumber: 0,
            timestamp: Date.now(),
            type: 'DATA',
            collectionName: 'test',
            operation: 'INSERT',
            data: { key: Math.random(), value: 'test data' },
            checksum: ''
          })
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(100) // Minimum 100 ops/sec
      expect(result.avgLatency).toBeLessThan(50) // Max 50ms average latency

      await walManager.close()
    })

    it('should benchmark MemoryWALManager write performance', async () => {
      const walManager = new MemoryWALManager()

      const result = await benchmark.measureOperation(
        'MemoryWALManager Write Operations',
        10000,
        async () => {
          await walManager.writeEntry({
            transactionId: 'tx-' + Math.random(),
            sequenceNumber: 0,
            timestamp: Date.now(),
            type: 'DATA',
            collectionName: 'test',
            operation: 'INSERT',
            data: { key: Math.random(), value: 'test data' },
            checksum: ''
          })
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(1000) // Minimum 1000 ops/sec for memory
      expect(result.avgLatency).toBeLessThan(5) // Max 5ms average latency

      await walManager.close()
    })

    it('should benchmark WAL read performance', async () => {
      const walPath = path.join(testDir, 'file-wal-read.log')
      const walManager = new FileWALManager({ walPath })

      // Prepare data
      for (let i = 0; i < 1000; i++) {
        await walManager.writeEntry({
          transactionId: 'tx-' + i,
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'DATA',
          collectionName: 'test',
          operation: 'INSERT',
          data: { key: i, value: 'test data ' + i },
          checksum: ''
        })
      }

      const result = await benchmark.measureOperation(
        'FileWALManager Read Operations',
        100,
        async () => {
          await walManager.readEntries()
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(10) // Minimum 10 reads/sec
      expect(result.avgLatency).toBeLessThan(100) // Max 100ms average latency

      await walManager.close()
    })

    it('should benchmark WAL recovery performance', async () => {
      const walPath = path.join(testDir, 'file-wal-recovery.log')
      const walManager = new FileWALManager({ walPath })

      // Prepare recovery data
      for (let i = 0; i < 100; i++) {
        await walManager.writeEntry({
          transactionId: 'tx-' + i,
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'BEGIN',
          collectionName: 'test',
          operation: 'BEGIN',
          data: { key: 'transaction' },
          checksum: ''
        })

        await walManager.writeEntry({
          transactionId: 'tx-' + i,
          sequenceNumber: 0,
          timestamp: Date.now(),
          type: 'DATA',
          collectionName: 'test',
          operation: 'INSERT',
          data: { key: i, value: 'test data ' + i },
          checksum: ''
        })

        if (i % 2 === 0) {
          await walManager.writeEntry({
            transactionId: 'tx-' + i,
            sequenceNumber: 0,
            timestamp: Date.now(),
            type: 'COMMIT',
            collectionName: 'test',
            operation: 'COMMIT',
            data: { key: 'transaction' },
            checksum: ''
          })
        }
      }

      await walManager.close()

      const result = await benchmark.measureOperation(
        'WAL Recovery Operations',
        10,
        async () => {
          const recoveryManager = new FileWALManager({ walPath })
          await recoveryManager.recover()
          await recoveryManager.close()
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(1) // Minimum 1 recovery/sec
      expect(result.avgLatency).toBeLessThan(5000) // Max 5 seconds recovery time
    })
  })

  describe('WALCollection Performance', () => {
    let walCollection: WALCollection<TestItem>

    beforeEach(async () => {
      // Create unique collection name for each test
      const collectionName = `performance-test-${Date.now()}-${Math.random()}`
      const config: WALCollectionConfig<TestItem> = {
        name: collectionName,
        root: testDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(testDir, `${collectionName}.wal`),
          enableWAL: true,
          autoRecovery: false
        }
      }

      walCollection = WALCollection.create(config)
    })

    afterEach(async () => {
      await walCollection.reset()
    })

    it('should benchmark collection create operations', async () => {
      const result = await benchmark.measureOperation(
        'Collection Create Operations',
        1000,
        async () => {
          const id = ++globalIdCounter // Use global counter for guaranteed uniqueness
          await walCollection.create({
            id,
            name: `Item ${id}`,
            data: 'test data '.repeat(10) // ~100 bytes per item
          })
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(50) // Minimum 50 creates/sec
      expect(result.avgLatency).toBeLessThan(100) // Max 100ms average latency
    })

    it('should benchmark transactional operations', async () => {
      const result = await benchmark.measureOperation(
        'Transactional Operations',
        100,
        async () => {
          const txId = await walCollection.beginTransaction()

          const id = ++globalIdCounter // Use global counter for guaranteed uniqueness
          await walCollection.create({
            id,
            name: `Transactional Item ${id}`,
            data: 'transactional data'
          })

          await walCollection.updateWithId(id, {
            name: `Updated Item ${id}`,
            timestamp: Date.now()
          })

          await walCollection.commitTransaction(txId)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(10) // Minimum 10 transactions/sec
      expect(result.avgLatency).toBeLessThan(500) // Max 500ms average latency
    })

    it('should benchmark find operations', async () => {
      // Prepare data with unique IDs
      const startId = globalIdCounter + 1
      for (let i = 0; i < 1000; i++) {
        const id = ++globalIdCounter
        await walCollection.create({
          id,
          name: `Item ${id}`,
          data: `data ${id}`
        })
      }
      const endId = globalIdCounter

      const result = await benchmark.measureOperation(
        'Collection Find Operations',
        1000,
        async () => {
          const id = startId + Math.floor(Math.random() * (endId - startId + 1))
          await walCollection.findById(id)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(100) // Minimum 100 finds/sec
      expect(result.avgLatency).toBeLessThan(50) // Max 50ms average latency
    })

    it('should benchmark persist operations', async () => {
      // Prepare data with unique IDs
      for (let i = 0; i < 100; i++) {
        const id = ++globalIdCounter
        await walCollection.create({
          id,
          name: `Item ${id}`,
          data: `data ${id}`
        })
      }

      const result = await benchmark.measureOperation(
        'Collection Persist Operations',
        10,
        async () => {
          await walCollection.persist()
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(1) // Minimum 1 persist/sec
      expect(result.avgLatency).toBeLessThan(2000) // Max 2 seconds persist time
    })
  })

  describe('WALDatabase Performance', () => {
    let walDatabase: WALDatabase

    beforeEach(async () => {
      const config: WALDatabaseConfig = {
        enableTransactions: true,
        globalWAL: false,
        walOptions: {
          enableWAL: true,
          autoRecovery: false
        }
      }

      walDatabase = new WALDatabase(testDir, 'performance-db', config)
      await walDatabase.connect()
    })

    afterEach(async () => {
      await walDatabase.close()
    })

    it('should benchmark database collection creation', async () => {
      const result = await benchmark.measureOperation(
        'Database Collection Creation',
        50,
        async () => {
          const collectionName = `collection-${Math.random()}`
          await walDatabase.createCollection<TestItem>(collectionName)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(5) // Minimum 5 collections/sec
      expect(result.avgLatency).toBeLessThan(1000) // Max 1 second creation time
    })

    it('should benchmark global transactions', async () => {
      // Create collections
      const collection1 = await walDatabase.createCollection<TestItem>('collection1')
      const collection2 = await walDatabase.createCollection<TestItem>('collection2')

      const result = await benchmark.measureOperation(
        'Global Transaction Operations',
        50,
        async () => {
          const txId = await walDatabase.beginGlobalTransaction()

          const id1 = ++globalIdCounter
          const id2 = ++globalIdCounter
          await collection1.create({ id: id1, name: `Item ${id1} in C1` })
          await collection2.create({ id: id2, name: `Item ${id2} in C2` })

          await walDatabase.commitGlobalTransaction(txId)
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(5) // Minimum 5 global transactions/sec
      expect(result.avgLatency).toBeLessThan(1000) // Max 1 second transaction time
    })

    it('should benchmark database persist operations', async () => {
      // Create collections with data
      const collection1 = await walDatabase.createCollection<TestItem>('collection1')
      const collection2 = await walDatabase.createCollection<TestItem>('collection2')

      for (let i = 0; i < 50; i++) {
        const id1 = ++globalIdCounter
        const id2 = ++globalIdCounter
        await collection1.create({ id: id1, name: `Item ${id1}` })
        await collection2.create({ id: id2, name: `Item ${id2}` })
      }

      const result = await benchmark.measureOperation(
        'Database Persist Operations',
        10,
        async () => {
          await walDatabase.persist()
        }
      )

      expect(result.opsPerSecond).toBeGreaterThan(1) // Minimum 1 database persist/sec
      expect(result.avgLatency).toBeLessThan(5000) // Max 5 seconds persist time
    })
  })

  describe('Memory Usage Benchmarks', () => {
    it('should benchmark memory usage with large datasets', async () => {
      const config: WALCollectionConfig<TestItem> = {
        name: 'memory-test',
        root: testDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(testDir, 'memory.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)

      const initialMemory = process.memoryUsage()

      // Create large dataset
      for (let i = 0; i < 10000; i++) {
        const id = ++globalIdCounter
        await collection.create({
          id,
          name: `Large Item ${id}`,
          data: 'x'.repeat(1000) // 1KB per item = 10MB total
        })
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`Memory increase for 10K items: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Should use less than 50MB for 10K items (including overhead)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      await collection.reset()
    })

    it('should benchmark memory usage with concurrent transactions', async () => {
      const config: WALCollectionConfig<TestItem> = {
        name: 'concurrent-memory-test',
        root: testDir,
        enableTransactions: true,
        walOptions: {
          walPath: path.join(testDir, 'concurrent.wal'),
          enableWAL: true,
          autoRecovery: false
        }
      }

      const collection = WALCollection.create(config)
      const initialMemory = process.memoryUsage()

      // Start multiple concurrent transactions
      const transactions: Promise<void>[] = []
      for (let i = 0; i < 10; i++) {
        transactions.push(
          (async () => {
            const txId = await collection.beginTransaction()

            for (let j = 0; j < 100; j++) {
              const id = ++globalIdCounter
              await collection.create({
                id,
                name: `Concurrent Item ${i}-${j}`,
                data: 'concurrent data'
              })
            }

            await collection.commitTransaction(txId)
          })()
        )
      }

      await Promise.all(transactions)

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`Memory increase for concurrent transactions: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Should use reasonable memory for concurrent operations
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024) // Less than 20MB

      await collection.reset()
    })
  })
})