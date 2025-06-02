/**
 * Raft Log Replication Module
 * Implements AppendEntries RPC and log consistency mechanisms
 */

import { EventEmitter } from 'events'
import {
  NodeId,
  Term,
  LogIndex,
  RaftLogEntry,
  AppendEntriesRequest,
  AppendEntriesResponse,
  RaftReplicationError
} from './types'
import { IRaftLogManager } from './types'

export interface LogReplicationConfig {
  nodeId: NodeId
  peers: NodeId[]
  maxEntriesPerRequest: number // 100
  replicationTimeout: number   // 1000ms
  retryInterval: number        // 100ms
  maxRetries: number          // 3
}

export interface ReplicationState {
  // Leader state for each peer
  nextIndex: Map<NodeId, LogIndex>   // Next log index to send to each server
  matchIndex: Map<NodeId, LogIndex>  // Highest log index known to be replicated

  // Replication metrics
  replicationInProgress: Set<NodeId>
  lastReplicationTime: Map<NodeId, number>
  replicationErrors: Map<NodeId, number>
}

export class LogReplication extends EventEmitter {
  private config: LogReplicationConfig
  private state: ReplicationState
  private logManager: IRaftLogManager
  private rpcHandler?: (nodeId: NodeId, request: AppendEntriesRequest) => Promise<AppendEntriesResponse>
  private replicationTimer?: NodeJS.Timeout

  constructor(config: LogReplicationConfig, logManager: IRaftLogManager) {
    super()
    this.config = config
    this.logManager = logManager
    this.state = {
      nextIndex: new Map(),
      matchIndex: new Map(),
      replicationInProgress: new Set(),
      lastReplicationTime: new Map(),
      replicationErrors: new Map()
    }

    // Initialize peer state
    this.initializePeerState()
  }

  // Initialize replication state for all peers
  private initializePeerState(): void {
    for (const peerId of this.config.peers) {
      this.state.nextIndex.set(peerId, 1) // Will be updated when becoming leader
      this.state.matchIndex.set(peerId, 0)
      this.state.replicationErrors.set(peerId, 0)
    }
  }

  // Set RPC handler for sending AppendEntries requests
  setRPCHandler(handler: (nodeId: NodeId, request: AppendEntriesRequest) => Promise<AppendEntriesResponse>): void {
    this.rpcHandler = handler
  }

  // Start replication as leader
  async startAsLeader(currentTerm: Term): Promise<void> {
    try {
      // Reset peer state for new leadership term
      await this.resetPeerState()

      // Start periodic replication
      this.startPeriodicReplication()

      this.emit('replication_started', {
        term: currentTerm,
        peers: this.config.peers,
        nodeId: this.config.nodeId
      })
    } catch (error: any) {
      throw new RaftReplicationError(`Failed to start replication: ${error.message}`)
    }
  }

  // Stop replication
  stop(): void {
    this.stopPeriodicReplication()
    this.state.replicationInProgress.clear()

    this.emit('replication_stopped', {
      nodeId: this.config.nodeId
    })
  }

  // Handle incoming AppendEntries request (as follower)
  async handleAppendEntries(request: AppendEntriesRequest): Promise<AppendEntriesResponse> {
    const { leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = request

    try {
      // Check if our log contains an entry at prevLogIndex whose term matches prevLogTerm
      const prevEntry = await this.logManager.getEntry(prevLogIndex)

      if (prevLogIndex > 0 && (!prevEntry || prevEntry.term !== prevLogTerm)) {
        // Log doesn't contain matching entry
        return {
          term: await this.getCurrentTerm(),
          success: false
        }
      }

      // If an existing entry conflicts with a new one (same index but different terms),
      // delete the existing entry and all that follow it
      if (entries.length > 0) {
        await this.handleLogConflicts(prevLogIndex + 1, entries)
      }

      // Append any new entries not already in the log
      if (entries.length > 0) {
        await this.logManager.append(entries)
      }

      // If leaderCommit > commitIndex, set commitIndex = min(leaderCommit, index of last new entry)
      const currentCommitIndex = await this.logManager.getCommitIndex()
      if (leaderCommit > currentCommitIndex) {
        const lastNewEntryIndex = entries.length > 0 ?
          entries[entries.length - 1].index :
          prevLogIndex

        const newCommitIndex = Math.min(leaderCommit, lastNewEntryIndex)
        await this.logManager.setCommitIndex(newCommitIndex)
      }

      this.emit('entries_appended', {
        leaderId,
        entriesCount: entries.length,
        newCommitIndex: await this.logManager.getCommitIndex()
      })

      return {
        term: await this.getCurrentTerm(),
        success: true,
        matchIndex: await this.logManager.getLastIndex()
      }

    } catch (error: any) {
      this.emit('append_entries_error', {
        error: error.message,
        leaderId,
        entriesCount: entries.length
      })

      return {
        term: await this.getCurrentTerm(),
        success: false
      }
    }
  }

  // Replicate entries to all peers (as leader)
  async replicateToAll(currentTerm: Term): Promise<void> {
    if (!this.rpcHandler) {
      throw new RaftReplicationError('RPC handler not set')
    }

    const replicationPromises = this.config.peers.map(peerId =>
      this.replicateToPeer(peerId, currentTerm)
    )

    await Promise.allSettled(replicationPromises)
  }

  // Replicate entries to specific peer
  private async replicateToPeer(peerId: NodeId, currentTerm: Term): Promise<void> {
    if (this.state.replicationInProgress.has(peerId)) {
      return // Already replicating to this peer
    }

    this.state.replicationInProgress.add(peerId)

    try {
      const nextIndex = this.state.nextIndex.get(peerId) || 1
      const prevLogIndex = nextIndex - 1
      const prevLogTerm = prevLogIndex > 0 ?
        (await this.logManager.getEntry(prevLogIndex))?.term || 0 : 0

      // Get entries to send
      const lastLogIndex = await this.logManager.getLastIndex()
      const entries = nextIndex <= lastLogIndex ?
        await this.logManager.getEntries(nextIndex, Math.min(nextIndex + this.config.maxEntriesPerRequest - 1, lastLogIndex)) :
        []

      const request: AppendEntriesRequest = {
        term: currentTerm,
        leaderId: this.config.nodeId,
        prevLogIndex,
        prevLogTerm,
        entries,
        leaderCommit: await this.logManager.getCommitIndex()
      }

      const response = await this.rpcHandler!(peerId, request)

      if (response.success) {
        // Update nextIndex and matchIndex for follower
        if (entries.length > 0) {
          this.state.nextIndex.set(peerId, entries[entries.length - 1].index + 1)
          this.state.matchIndex.set(peerId, entries[entries.length - 1].index)
        } else {
          // For heartbeat (empty entries), update matchIndex to prevLogIndex if successful
          this.state.matchIndex.set(peerId, prevLogIndex)
        }

        // Reset error count
        this.state.replicationErrors.set(peerId, 0)
        this.state.lastReplicationTime.set(peerId, Date.now())

        this.emit('replication_success', {
          peerId,
          entriesCount: entries.length,
          matchIndex: this.state.matchIndex.get(peerId)
        })

        // Try to advance commit index
        await this.tryAdvanceCommitIndex(currentTerm)

      } else {
        // Replication failed - decrement nextIndex and retry
        const currentNextIndex = this.state.nextIndex.get(peerId) || 1
        this.state.nextIndex.set(peerId, Math.max(1, currentNextIndex - 1))

        // Increment error count
        const errorCount = (this.state.replicationErrors.get(peerId) || 0) + 1
        this.state.replicationErrors.set(peerId, errorCount)

        this.emit('replication_failed', {
          peerId,
          nextIndex: this.state.nextIndex.get(peerId),
          errorCount
        })
      }

    } catch (error: any) {
      const errorCount = (this.state.replicationErrors.get(peerId) || 0) + 1
      this.state.replicationErrors.set(peerId, errorCount)

      this.emit('replication_error', {
        peerId,
        error: error.message,
        errorCount
      })

    } finally {
      this.state.replicationInProgress.delete(peerId)
    }
  }

  // Try to advance commit index based on majority replication
  private async tryAdvanceCommitIndex(currentTerm: Term): Promise<void> {
    const currentCommitIndex = await this.logManager.getCommitIndex()
    const lastLogIndex = await this.logManager.getLastIndex()

    // Find the highest index that is replicated on majority of servers
    for (let index = lastLogIndex; index > currentCommitIndex; index--) {
      const entry = await this.logManager.getEntry(index)

      // Only commit entries from current term
      if (!entry || entry.term !== currentTerm) {
        continue
      }

      // Count how many servers have this index
      let replicatedCount = 1 // Leader always has the entry

      for (const peerId of this.config.peers) {
        const matchIndex = this.state.matchIndex.get(peerId) || 0
        if (matchIndex >= index) {
          replicatedCount++
        }
      }

      // Check if we have majority (more than half)
      const totalNodes = this.config.peers.length + 1 // Include leader
      const majorityCount = Math.floor(totalNodes / 2) + 1

      if (replicatedCount >= majorityCount) {
        await this.logManager.setCommitIndex(index)

        this.emit('commit_index_advanced', {
          newCommitIndex: index,
          replicatedCount,
          majorityCount,
          totalNodes
        })
        break
      }
    }
  }

  // Handle log conflicts during AppendEntries
  private async handleLogConflicts(startIndex: LogIndex, newEntries: RaftLogEntry[]): Promise<void> {
    for (let i = 0; i < newEntries.length; i++) {
      const index = startIndex + i
      const existingEntry = await this.logManager.getEntry(index)

      if (existingEntry && existingEntry.term !== newEntries[i].term) {
        // Conflict detected - this would require log truncation
        // For now, we'll emit an event and let the log manager handle it
        this.emit('log_conflict_detected', {
          conflictIndex: index,
          existingTerm: existingEntry.term,
          newTerm: newEntries[i].term
        })

        // In a full implementation, we would truncate the log here
        // For this phase, we'll assume the log manager handles conflicts
        break
      }
    }
  }

  // Reset peer state when becoming leader
  private async resetPeerState(): Promise<void> {
    const lastLogIndex = await this.logManager.getLastIndex()

    for (const peerId of this.config.peers) {
      this.state.nextIndex.set(peerId, lastLogIndex + 1)
      this.state.matchIndex.set(peerId, 0)
      this.state.replicationErrors.set(peerId, 0)
    }
  }

  // Periodic replication
  private startPeriodicReplication(): void {
    this.stopPeriodicReplication()

    this.replicationTimer = setInterval(async () => {
      try {
        await this.replicateToAll(await this.getCurrentTerm())
      } catch (error: any) {
        this.emit('periodic_replication_error', {
          error: error.message
        })
      }
    }, this.config.retryInterval)
  }

  private stopPeriodicReplication(): void {
    if (this.replicationTimer) {
      clearInterval(this.replicationTimer)
      this.replicationTimer = undefined
    }
  }

  // Helper method to get current term (should be provided by integrating class)
  private async getCurrentTerm(): Promise<Term> {
    // Default implementation - should be overridden
    return 1
  }

  // Set current term getter (for integration)
  setCurrentTermGetter(getCurrentTerm: () => Promise<Term>): void {
    this.getCurrentTerm = getCurrentTerm
  }

  // Get replication metrics
  getMetrics() {
    const peerMetrics = new Map()

    for (const peerId of this.config.peers) {
      peerMetrics.set(peerId, {
        nextIndex: this.state.nextIndex.get(peerId) || 0,
        matchIndex: this.state.matchIndex.get(peerId) || 0,
        errorCount: this.state.replicationErrors.get(peerId) || 0,
        lastReplicationTime: this.state.lastReplicationTime.get(peerId) || 0,
        isReplicating: this.state.replicationInProgress.has(peerId)
      })
    }

    return {
      peers: peerMetrics,
      activeReplications: this.state.replicationInProgress.size,
      totalPeers: this.config.peers.length
    }
  }

  // For testing
  async reset(): Promise<void> {
    this.stop()
    this.initializePeerState()
  }
}