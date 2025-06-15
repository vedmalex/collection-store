/**
 * Raft State Machine Tests
 * Tests for state machine integration with collection operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { RaftStateMachine, RaftStateMachineConfig } from '../replication/raft/RaftStateMachine'
import { RaftLogEntry, RaftCommand } from '../replication/raft/types'

describe('Raft State Machine', () => {
  const testDir = './test-data/raft-state-machine'
  let stateMachine: RaftStateMachine
  let config: RaftStateMachineConfig

  beforeEach(async () => {
    await fs.ensureDir(testDir)

    config = {
      nodeId: 'test-node-1',
      dataPath: testDir,
      enableSnapshots: true,
      snapshotInterval: 5
    }

    stateMachine = new RaftStateMachine(config)
    await stateMachine.initialize()
  })

  afterEach(async () => {
    try {
      await stateMachine.close()
    } catch (error) {
      console.warn('Cleanup error:', error)
    }

    try {
      await fs.remove(testDir)
    } catch (error) {
      console.warn('Directory cleanup error:', error)
    }
  })

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      const metrics = stateMachine.getMetrics()

      expect(metrics.lastAppliedIndex).toBe(0)
      expect(metrics.lastAppliedTerm).toBe(0)
      expect(metrics.appliedEntriesCount).toBe(0)
      expect(metrics.snapshotCount).toBe(0)
      expect(metrics.collectionsCount).toBe(0)
    })
  })

  describe('Command Application', () => {
    it('should apply CREATE command', async () => {
      const entry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'CREATE',
          collectionName: 'users',
          data: { id: 1, name: 'John Doe', email: 'john@example.com' }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      const result = await stateMachine.apply(entry)

      expect(result).toBeDefined()
      expect(result.id).toBe(1)

      const metrics = stateMachine.getMetrics()
      expect(metrics.lastAppliedIndex).toBe(1)
      expect(metrics.appliedEntriesCount).toBe(1)
      expect(metrics.collectionsCount).toBe(1)
    })

    it('should apply UPDATE command', async () => {
      // First create an item
      const createEntry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'CREATE',
          collectionName: 'users',
          data: { id: 1, name: 'John Doe', email: 'john@example.com' }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      await stateMachine.apply(createEntry)

      // Then update it
      const updateEntry: RaftLogEntry = {
        term: 1,
        index: 2,
        command: {
          type: 'UPDATE',
          collectionName: 'users',
          data: { id: 1, updates: { name: 'Jane Doe' } }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-2'
      }

      const result = await stateMachine.apply(updateEntry)

      expect(result).toBeDefined()
      expect(result.name).toBe('Jane Doe')

      const metrics = stateMachine.getMetrics()
      expect(metrics.lastAppliedIndex).toBe(2)
      expect(metrics.appliedEntriesCount).toBe(2)
    })

    it('should apply DELETE command', async () => {
      // First create an item
      const createEntry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'CREATE',
          collectionName: 'users',
          data: { id: 1, name: 'John Doe', email: 'john@example.com' }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      await stateMachine.apply(createEntry)

      // Then delete it
      const deleteEntry: RaftLogEntry = {
        term: 1,
        index: 2,
        command: {
          type: 'DELETE',
          collectionName: 'users',
          data: { id: 1 }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-2'
      }

      const result = await stateMachine.apply(deleteEntry)

      expect(result).toBeDefined()

      const metrics = stateMachine.getMetrics()
      expect(metrics.lastAppliedIndex).toBe(2)
      expect(metrics.appliedEntriesCount).toBe(2)
    })

    it('should reject entries with invalid index', async () => {
      const entry: RaftLogEntry = {
        term: 1,
        index: 0, // Invalid - should be > 0
        command: {
          type: 'CREATE',
          collectionName: 'users',
          data: { id: 1, name: 'John Doe' }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      await expect(stateMachine.apply(entry)).rejects.toThrow('not greater than last applied')
    })
  })

  describe('Transaction Commands', () => {
    it('should handle transaction begin', async () => {
      const entry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'TRANSACTION_BEGIN',
          collectionName: 'users',
          data: {},
          transactionId: 'tx-1'
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      const result = await stateMachine.apply(entry)

      expect(result).toBeDefined()
      expect(result.transactionId).toBeDefined()
    })

    it('should handle transaction commit', async () => {
      // Begin transaction first
      const beginEntry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'TRANSACTION_BEGIN',
          collectionName: 'users',
          data: {},
          transactionId: 'tx-1'
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      const beginResult = await stateMachine.apply(beginEntry)

      // Commit transaction
      const commitEntry: RaftLogEntry = {
        term: 1,
        index: 2,
        command: {
          type: 'TRANSACTION_COMMIT',
          collectionName: 'users',
          data: {},
          transactionId: beginResult.transactionId
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-2'
      }

      const result = await stateMachine.apply(commitEntry)

      expect(result).toBeDefined()
      expect(result.committed).toBe(true)
    })
  })

  describe('Snapshots', () => {
    it('should create snapshot', async () => {
      // Add some data
      for (let i = 1; i <= 3; i++) {
        const entry: RaftLogEntry = {
          term: 1,
          index: i,
          command: {
            type: 'CREATE',
            collectionName: 'users',
            data: { id: i, name: `User ${i}` }
          },
          timestamp: Date.now(),
          nodeId: 'test-node-1',
          checksum: `checksum-${i}`
        }

        await stateMachine.apply(entry)
      }

      const snapshot = await stateMachine.createSnapshot()

      expect(snapshot).toBeInstanceOf(Buffer)
      expect(snapshot.length).toBeGreaterThan(0)

      const metrics = stateMachine.getMetrics()
      expect(metrics.snapshotCount).toBe(1)
    })

    it('should restore from snapshot', async () => {
      // Create snapshot data
      const snapshotData = {
        lastAppliedIndex: 3,
        lastAppliedTerm: 1,
        appliedEntriesCount: 3,
        collections: {
          users: {
            name: 'users',
            data: [
              { id: 1, name: 'User 1' },
              { id: 2, name: 'User 2' },
              { id: 3, name: 'User 3' }
            ],
            metadata: { count: 3, lastModified: Date.now() }
          }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1'
      }

      const snapshotBuffer = Buffer.from(JSON.stringify(snapshotData), 'utf8')

      await stateMachine.restoreSnapshot(snapshotBuffer)

      const metrics = stateMachine.getMetrics()
      expect(metrics.lastAppliedIndex).toBe(3)
      expect(metrics.appliedEntriesCount).toBe(3)
      expect(metrics.collectionsCount).toBe(1)
    })

    it('should trigger automatic snapshot', async () => {
      let snapshotCreated = false
      stateMachine.on('snapshot_created', () => {
        snapshotCreated = true
      })

      // Apply enough entries to trigger snapshot (snapshotInterval = 5)
      for (let i = 1; i <= 5; i++) {
        const entry: RaftLogEntry = {
          term: 1,
          index: i,
          command: {
            type: 'CREATE',
            collectionName: 'users',
            data: { id: i, name: `User ${i}` }
          },
          timestamp: Date.now(),
          nodeId: 'test-node-1',
          checksum: `checksum-${i}`
        }

        await stateMachine.apply(entry)
      }

      expect(snapshotCreated).toBe(true)
    })
  })

  describe('Read Operations', () => {
    it('should perform read operations', async () => {
      // First create some data
      const entry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'CREATE',
          collectionName: 'users',
          data: { id: 1, name: 'John Doe', email: 'john@example.com' }
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      await stateMachine.apply(entry)

      // Then read it
      const result = await stateMachine.read('users', { id: 1 })

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should throw error for non-existent collection', async () => {
      await expect(stateMachine.read('nonexistent', {})).rejects.toThrow('Collection nonexistent not found')
    })
  })

  describe('State Management', () => {
    it('should track last applied index', async () => {
      expect(await stateMachine.getLastAppliedIndex()).toBe(0)

      await stateMachine.setLastAppliedIndex(5)

      expect(await stateMachine.getLastAppliedIndex()).toBe(5)
    })

    it('should not allow decreasing last applied index', async () => {
      await stateMachine.setLastAppliedIndex(5)

      await expect(stateMachine.setLastAppliedIndex(3)).rejects.toThrow('Cannot decrease last applied index')
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown command types', async () => {
      const entry: RaftLogEntry = {
        term: 1,
        index: 1,
        command: {
          type: 'UNKNOWN' as any,
          collectionName: 'users',
          data: {}
        },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }

      await expect(stateMachine.apply(entry)).rejects.toThrow('Unknown command type')
    })
  })

  describe('Metrics', () => {
    it('should provide accurate metrics', () => {
      const metrics = stateMachine.getMetrics()

      expect(typeof metrics.lastAppliedIndex).toBe('number')
      expect(typeof metrics.lastAppliedTerm).toBe('number')
      expect(typeof metrics.appliedEntriesCount).toBe('number')
      expect(typeof metrics.snapshotCount).toBe('number')
      expect(typeof metrics.collectionsCount).toBe('number')
      expect(Array.isArray(metrics.collectionsNames)).toBe(true)
    })
  })
})