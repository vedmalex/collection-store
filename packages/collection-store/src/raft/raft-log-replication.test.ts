/**
 * Raft Log Replication Tests
 * Tests for AppendEntries RPC and log consistency mechanisms
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { LogReplication, LogReplicationConfig } from '../replication/raft/LogReplication'
import { RaftLogManager, RaftLogManagerConfig } from '../replication/raft/RaftLogManager'
import {
  RaftLogEntry,
  RaftCommand,
  AppendEntriesRequest,
  AppendEntriesResponse,
  Term,
  LogIndex
} from '../replication/raft/types'

describe('Raft Log Replication', () => {
  const testDir = './test-data/raft-log-replication'
  let logReplication: LogReplication
  let logManager: RaftLogManager
  let config: LogReplicationConfig

  beforeEach(async () => {
    await fs.ensureDir(testDir)

    // Setup log manager
    const logManagerConfig: RaftLogManagerConfig = {
      nodeId: 'test-node-1',
      logPath: path.join(testDir, 'raft.log'),
      snapshotPath: path.join(testDir, 'snapshot'),
      snapshotThreshold: 100,
      enableCompaction: true
    }

    logManager = new RaftLogManager(logManagerConfig)
    await logManager.initialize()

    // Setup replication config
    config = {
      nodeId: 'test-node-1',
      peers: ['test-node-2', 'test-node-3'],
      maxEntriesPerRequest: 10,
      replicationTimeout: 1000,
      retryInterval: 100,
      maxRetries: 3
    }

    logReplication = new LogReplication(config, logManager)
  })

  afterEach(async () => {
    try {
      await logReplication.reset()
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

  describe('Initialization', () => {
    it('should initialize with correct peer state', () => {
      const metrics = logReplication.getMetrics()

      expect(metrics.totalPeers).toBe(2)
      expect(metrics.activeReplications).toBe(0)
      expect(metrics.peers.size).toBe(2)

      // Check initial peer state
      for (const [peerId, peerMetrics] of metrics.peers) {
        expect(peerMetrics.nextIndex).toBe(1)
        expect(peerMetrics.matchIndex).toBe(0)
        expect(peerMetrics.errorCount).toBe(0)
        expect(peerMetrics.isReplicating).toBe(false)
      }
    })
  })

  describe('AppendEntries Handling (Follower)', () => {
    beforeEach(async () => {
      // Add some initial entries to log
      const entries: RaftLogEntry[] = []
      for (let i = 1; i <= 3; i++) {
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
      await logManager.setCommitIndex(2)
    })

    it('should accept valid AppendEntries request', async () => {
      const newEntries: RaftLogEntry[] = [{
        term: 2,
        index: 4,
        command: {
          type: 'UPDATE',
          collectionName: 'test',
          data: { id: 4, updated: true }
        },
        timestamp: Date.now(),
        nodeId: 'leader-node',
        checksum: 'checksum-4'
      }]

      const request: AppendEntriesRequest = {
        term: 2,
        leaderId: 'leader-node',
        prevLogIndex: 3,
        prevLogTerm: 1,
        entries: newEntries,
        leaderCommit: 3
      }

      // Mock getCurrentTerm
      logReplication.setCurrentTermGetter(async () => 2)

      const response = await logReplication.handleAppendEntries(request)

      expect(response.success).toBe(true)
      expect(response.term).toBe(2)
      expect(response.matchIndex).toBe(4)

      // Verify entry was appended
      const lastIndex = await logManager.getLastIndex()
      expect(lastIndex).toBe(4)

      const appendedEntry = await logManager.getEntry(4)
      expect(appendedEntry).toEqual(newEntries[0])

      // Verify commit index was updated
      const commitIndex = await logManager.getCommitIndex()
      expect(commitIndex).toBe(3)
    })

    it('should reject AppendEntries with mismatched prevLog', async () => {
      const newEntries: RaftLogEntry[] = [{
        term: 2,
        index: 4,
        command: {
          type: 'CREATE',
          collectionName: 'test',
          data: { id: 4 }
        },
        timestamp: Date.now(),
        nodeId: 'leader-node',
        checksum: 'checksum-4'
      }]

      const request: AppendEntriesRequest = {
        term: 2,
        leaderId: 'leader-node',
        prevLogIndex: 3,
        prevLogTerm: 2, // Wrong term - should be 1
        entries: newEntries,
        leaderCommit: 3
      }

      logReplication.setCurrentTermGetter(async () => 2)

      const response = await logReplication.handleAppendEntries(request)

      expect(response.success).toBe(false)
      expect(response.term).toBe(2)

      // Verify entry was not appended
      const lastIndex = await logManager.getLastIndex()
      expect(lastIndex).toBe(3) // Should remain unchanged
    })

    it('should handle empty AppendEntries (heartbeat)', async () => {
      const request: AppendEntriesRequest = {
        term: 2,
        leaderId: 'leader-node',
        prevLogIndex: 3,
        prevLogTerm: 1,
        entries: [], // Empty - heartbeat
        leaderCommit: 3
      }

      logReplication.setCurrentTermGetter(async () => 2)

      const response = await logReplication.handleAppendEntries(request)

      expect(response.success).toBe(true)
      expect(response.term).toBe(2)

      // Verify commit index was updated
      const commitIndex = await logManager.getCommitIndex()
      expect(commitIndex).toBe(3)
    })
  })

  describe('Leader Replication', () => {
    beforeEach(async () => {
      // Add some entries to replicate
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

      logReplication.setCurrentTermGetter(async () => 1)
    })

    it('should start replication as leader', async () => {
      let replicationStarted = false
      logReplication.on('replication_started', () => {
        replicationStarted = true
      })

      await logReplication.startAsLeader(1)

      expect(replicationStarted).toBe(true)

      const metrics = logReplication.getMetrics()

      // Verify peer state was reset
      for (const [peerId, peerMetrics] of metrics.peers) {
        expect(peerMetrics.nextIndex).toBe(6) // lastLogIndex + 1
        expect(peerMetrics.matchIndex).toBe(0)
        expect(peerMetrics.errorCount).toBe(0)
      }
    })

    it('should replicate to all peers successfully', async () => {
      let successCount = 0
      logReplication.on('replication_success', () => {
        successCount++
      })

      // Mock successful RPC responses
      logReplication.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        success: true,
        matchIndex: request.entries.length > 0 ?
          request.entries[request.entries.length - 1].index :
          request.prevLogIndex
      }))

      await logReplication.startAsLeader(1)
      await logReplication.replicateToAll(1)

      expect(successCount).toBe(2) // Two peers

      const metrics = logReplication.getMetrics()

      // Verify match indices were updated
      for (const [peerId, peerMetrics] of metrics.peers) {
        expect(peerMetrics.matchIndex).toBeGreaterThan(0)
      }
    })

    it('should handle replication failures', async () => {
      let failureCount = 0
      logReplication.on('replication_failed', () => {
        failureCount++
      })

      // Mock failed RPC responses
      logReplication.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        success: false
      }))

      await logReplication.startAsLeader(1)
      await logReplication.replicateToAll(1)

      expect(failureCount).toBe(2) // Two peers failed

      const metrics = logReplication.getMetrics()

      // Verify nextIndex was decremented
      for (const [peerId, peerMetrics] of metrics.peers) {
        expect(peerMetrics.nextIndex).toBe(5) // Decremented from 6
        expect(peerMetrics.errorCount).toBe(1)
      }
    })

    it('should advance commit index with majority replication', async () => {
      let commitAdvanced = false
      logReplication.on('commit_index_advanced', () => {
        commitAdvanced = true
      })

      // Mock one successful and one failed replication (majority = 2/3)
      let callCount = 0
      logReplication.setRPCHandler(async (nodeId, request) => {
        callCount++
        return {
          term: request.term,
          success: callCount === 1, // First call succeeds, second fails
          matchIndex: callCount === 1 ? 5 : undefined
        }
      })

      await logReplication.startAsLeader(1)
      await logReplication.replicateToAll(1)

      expect(commitAdvanced).toBe(true)

      // Verify commit index was advanced
      const commitIndex = await logManager.getCommitIndex()
      expect(commitIndex).toBeGreaterThan(3)
    })
  })

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      let errorCount = 0
      logReplication.on('replication_error', () => {
        errorCount++
      })

      // Mock RPC handler that throws errors
      logReplication.setRPCHandler(async (nodeId, request) => {
        throw new Error('Network error')
      })

      await logReplication.startAsLeader(1)
      await logReplication.replicateToAll(1)

      expect(errorCount).toBe(2) // Two peers

      const metrics = logReplication.getMetrics()

      // Verify error counts were incremented
      for (const [peerId, peerMetrics] of metrics.peers) {
        expect(peerMetrics.errorCount).toBe(1)
      }
    })

    it('should throw error when RPC handler not set', async () => {
      await expect(logReplication.replicateToAll(1)).rejects.toThrow('RPC handler not set')
    })
  })

  describe('Log Conflicts', () => {
    it('should detect log conflicts', async () => {
      let conflictDetected = false
      logReplication.on('log_conflict_detected', () => {
        conflictDetected = true
      })

      // Add initial entry
      await logManager.append([{
        term: 1,
        index: 1,
        command: { type: 'CREATE', collectionName: 'test', data: { id: 1 } },
        timestamp: Date.now(),
        nodeId: 'test-node-1',
        checksum: 'checksum-1'
      }])

      // Try to append conflicting entry
      const conflictingEntries: RaftLogEntry[] = [{
        term: 2, // Different term
        index: 1,
        command: { type: 'UPDATE', collectionName: 'test', data: { id: 1, updated: true } },
        timestamp: Date.now(),
        nodeId: 'leader-node',
        checksum: 'checksum-1-conflict'
      }]

      const request: AppendEntriesRequest = {
        term: 2,
        leaderId: 'leader-node',
        prevLogIndex: 0,
        prevLogTerm: 0,
        entries: conflictingEntries,
        leaderCommit: 1
      }

      logReplication.setCurrentTermGetter(async () => 2)

      await logReplication.handleAppendEntries(request)

      expect(conflictDetected).toBe(true)
    })
  })

  describe('Metrics', () => {
    it('should provide accurate replication metrics', () => {
      const metrics = logReplication.getMetrics()

      expect(metrics.totalPeers).toBe(2)
      expect(metrics.activeReplications).toBe(0)
      expect(metrics.peers).toBeInstanceOf(Map)
      expect(metrics.peers.size).toBe(2)

      for (const [peerId, peerMetrics] of metrics.peers) {
        expect(typeof peerMetrics.nextIndex).toBe('number')
        expect(typeof peerMetrics.matchIndex).toBe('number')
        expect(typeof peerMetrics.errorCount).toBe('number')
        expect(typeof peerMetrics.lastReplicationTime).toBe('number')
        expect(typeof peerMetrics.isReplicating).toBe('boolean')
      }
    })
  })
})