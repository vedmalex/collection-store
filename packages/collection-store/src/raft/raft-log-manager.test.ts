/**
 * Raft Log Manager Tests
 * Tests for Raft log management with WAL integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { RaftLogManager, RaftLogManagerConfig } from '../replication/raft/RaftLogManager'
import { RaftLogEntry, RaftCommand } from '../replication/raft/types'

describe('Raft Log Manager', () => {
  const testDir = './test-data/raft-log-manager'
  let logManager: RaftLogManager
  let config: RaftLogManagerConfig

  beforeEach(async () => {
    await fs.ensureDir(testDir)

    config = {
      nodeId: 'test-node-1',
      logPath: path.join(testDir, 'raft.log'),
      snapshotPath: path.join(testDir, 'snapshot'),
      snapshotThreshold: 100,
      enableCompaction: true
    }

    logManager = new RaftLogManager(config)
    await logManager.initialize()
  })

  afterEach(async () => {
    try {
      await logManager.close()
    } catch (error) {
      console.warn('Cleanup error:', error)
    }

    try {
      await fs.remove(testDir)
    } catch (error) {
      console.warn('Directory cleanup error:', error)
    }
  })

  describe('Basic Operations', () => {
    it('should initialize successfully', async () => {
      expect(logManager).toBeDefined()

      const lastIndex = await logManager.getLastIndex()
      const lastTerm = await logManager.getLastTerm()
      const commitIndex = await logManager.getCommitIndex()

      expect(lastIndex).toBe(0)
      expect(lastTerm).toBe(0)
      expect(commitIndex).toBe(0)
    })

    it('should append single entry', async () => {
      const command: RaftCommand = {
        type: 'CREATE',
        collectionName: 'users',
        data: { id: 1, name: 'John' }
      }

      const entry: RaftLogEntry = {
        term: 1,
        index: 1,
        command,
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'test-checksum'
      }

      await logManager.append([entry])

      const lastIndex = await logManager.getLastIndex()
      const lastTerm = await logManager.getLastTerm()

      expect(lastIndex).toBe(1)
      expect(lastTerm).toBe(1)

      const retrievedEntry = await logManager.getEntry(1)
      expect(retrievedEntry).toEqual(entry)
    })

    it('should append multiple entries', async () => {
      const entries: RaftLogEntry[] = []

      for (let i = 1; i <= 5; i++) {
        entries.push({
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
        })
      }

      await logManager.append(entries)

      const lastIndex = await logManager.getLastIndex()
      expect(lastIndex).toBe(5)

      // Verify all entries
      for (let i = 1; i <= 5; i++) {
        const entry = await logManager.getEntry(i)
        expect(entry).toBeDefined()
        expect(entry!.index).toBe(i)
        expect(entry!.command.data.id).toBe(i)
      }
    })
  })

  describe('Commit Index Management', () => {
    beforeEach(async () => {
      // Add some test entries
      const entries: RaftLogEntry[] = []
      for (let i = 1; i <= 5; i++) {
        entries.push({
          term: 1,
          index: i,
          command: {
            type: 'CREATE',
            collectionName: 'test',
            data: { id: i }
          },
          timestamp: Date.now(),
          nodeId: 'test-node-1',
          checksum: `checksum-${i}`
        })
      }
      await logManager.append(entries)
    })

    it('should set commit index', async () => {
      await logManager.setCommitIndex(3)

      const commitIndex = await logManager.getCommitIndex()
      expect(commitIndex).toBe(3)
    })

    it('should not allow decreasing commit index', async () => {
      await logManager.setCommitIndex(3)

      await expect(logManager.setCommitIndex(2)).rejects.toThrow('Cannot decrease commit index')
    })
  })

  describe('Metrics', () => {
    it('should provide accurate metrics', async () => {
      const entries: RaftLogEntry[] = []
      for (let i = 1; i <= 5; i++) {
        entries.push({
          term: 1,
          index: i,
          command: {
            type: 'CREATE',
            collectionName: 'test',
            data: { id: i }
          },
          timestamp: Date.now(),
          nodeId: 'test-node-1',
          checksum: `checksum-${i}`
        })
      }

      await logManager.append(entries)
      await logManager.setCommitIndex(3)

      const metrics = logManager.getMetrics()

      expect(metrics.entriesCount).toBe(5)
      expect(metrics.commitIndex).toBe(3)
      expect(metrics.snapshotIndex).toBe(0)
      expect(metrics.memoryUsage).toBeGreaterThan(0)
    })
  })
})
