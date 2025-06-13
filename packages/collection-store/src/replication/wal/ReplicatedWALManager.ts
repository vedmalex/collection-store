/**
 * Replicated WAL Manager
 * Расширяет FileWALManager с enterprise-grade репликацией
 */

import { EventEmitter } from 'events'
import { FileWALManager } from '../../wal/FileWALManager'
import { IWALManager, WALEntry, WALCheckpoint, WALManagerOptions } from '../../wal/WALTypes'
import { INetworkManager, ReplicationConfig } from '../types/ReplicationTypes'
import { WALReplicationManager } from './WALReplicationManager'

export interface ReplicatedWALOptions extends WALManagerOptions {
  replication: {
    enabled: boolean
    networkManager: INetworkManager
    config: ReplicationConfig
    role?: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'
  }
}

export class ReplicatedWALManager extends EventEmitter implements IWALManager {
  private fileWALManager: FileWALManager
  private replicationManager?: WALReplicationManager
  private options: ReplicatedWALOptions
  private role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'
  private isReplicationEnabled: boolean

  constructor(options: ReplicatedWALOptions) {
    super()
    this.options = options
    this.role = options.replication.role || 'FOLLOWER'
    this.isReplicationEnabled = options.replication.enabled

    // Initialize base WAL manager
    this.fileWALManager = new FileWALManager(options)

    // Initialize replication if enabled
    if (this.isReplicationEnabled) {
      this.initializeReplication()
    }
  }

  private initializeReplication(): void {
    if (!this.options.replication.networkManager) {
      throw new Error('NetworkManager is required for replication')
    }

    this.replicationManager = new WALReplicationManager(
      this,
      this.options.replication.networkManager,
      this.options.replication.config
    )

    // Set initial role
    this.replicationManager.setRole(this.role)

    // Setup event forwarding
    this.replicationManager.on('entryReplicated', (entry) => {
      this.emit('entryReplicated', entry)
    })

    this.replicationManager.on('entryReceived', (entry, sourceNode) => {
      this.emit('entryReceived', entry, sourceNode)
    })

    this.replicationManager.on('replicationError', (error, entry) => {
      this.emit('replicationError', error, entry)
    })

    this.replicationManager.on('roleChanged', (newRole) => {
      this.role = newRole
      this.emit('roleChanged', newRole)
    })

    console.log(`ReplicatedWALManager initialized with role: ${this.role}`)
  }

  async writeEntry(entry: WALEntry): Promise<void> {
    // Always write to local WAL first
    await this.fileWALManager.writeEntry(entry)

    // Replicate if we're the leader and replication is enabled
    if (this.isReplicationEnabled && this.role === 'LEADER' && this.replicationManager) {
      try {
        await this.replicationManager.streamWALEntry(entry)
      } catch (error) {
        console.error(`Failed to replicate WAL entry ${entry.sequenceNumber}:`, error)
        this.emit('replicationError', error, entry)

        // Don't fail the write operation, just log the replication failure
        // The entry is already persisted locally
      }
    }
  }

  async readEntries(fromSequence: number = 0): Promise<WALEntry[]> {
    return this.fileWALManager.readEntries(fromSequence)
  }

  async truncate(beforeSequence: number): Promise<void> {
    await this.fileWALManager.truncate(beforeSequence)

    // Notify replicas about truncation if we're the leader
    if (this.isReplicationEnabled && this.role === 'LEADER' && this.replicationManager) {
      // Create a special truncation entry
      const truncationEntry: WALEntry = {
        transactionId: 'TRUNCATION',
        sequenceNumber: 0, // Will be assigned
        timestamp: Date.now(),
        type: 'DATA',
        collectionName: '*',
        operation: 'STORE',
        data: {
          key: 'truncation',
          beforeSequence
        },
        checksum: ''
      }

      try {
        await this.replicationManager.streamWALEntry(truncationEntry)
      } catch (error) {
        console.warn(`Failed to replicate truncation:`, error)
      }
    }
  }

  async flush(): Promise<void> {
    await this.fileWALManager.flush()
  }

  async recover(): Promise<void> {
    await this.fileWALManager.recover()

    // After recovery, sync with other nodes if we're a follower
    if (this.isReplicationEnabled && this.role === 'FOLLOWER' && this.replicationManager) {
      await this.syncWithCluster()
    }
  }

  async createCheckpoint(): Promise<WALCheckpoint> {
    const checkpoint = await this.fileWALManager.createCheckpoint()

    // Replicate checkpoint if we're the leader
    if (this.isReplicationEnabled && this.role === 'LEADER' && this.replicationManager) {
      const checkpointEntry: WALEntry = {
        transactionId: 'CHECKPOINT',
        sequenceNumber: 0, // Will be assigned
        timestamp: checkpoint.timestamp,
        type: 'DATA',
        collectionName: '*',
        operation: 'STORE',
        data: {
          key: 'checkpoint',
          checkpointId: checkpoint.checkpointId
        },
        checksum: ''
      }

      try {
        await this.replicationManager.streamWALEntry(checkpointEntry)
      } catch (error) {
        console.warn(`Failed to replicate checkpoint:`, error)
      }
    }

    return checkpoint
  }

  getCurrentSequence(): number {
    return this.fileWALManager.getCurrentSequence()
  }

  async close(): Promise<void> {
    if (this.replicationManager) {
      await this.replicationManager.close()
    }
    await this.fileWALManager.close()
    this.removeAllListeners()
  }

  // Replication-specific methods

  setRole(role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'): void {
    this.role = role
    if (this.replicationManager) {
      this.replicationManager.setRole(role)
    }
    this.emit('roleChanged', role)
  }

  getRole(): 'LEADER' | 'FOLLOWER' | 'CANDIDATE' {
    return this.role
  }

  async promoteToLeader(): Promise<void> {
    console.log(`Promoting node to LEADER`)
    this.setRole('LEADER')

    // Ensure we have the latest data by syncing first
    if (this.replicationManager) {
      await this.syncWithCluster()
    }
  }

  async demoteToFollower(): Promise<void> {
    console.log(`Demoting node to FOLLOWER`)
    this.setRole('FOLLOWER')
  }

  async syncWithCluster(): Promise<void> {
    if (!this.replicationManager) {
      return
    }

    const connectedNodes = this.options.replication.networkManager.getConnectedNodes()
    if (connectedNodes.length === 0) {
      console.log('No connected nodes to sync with')
      return
    }

    const currentSequence = this.getCurrentSequence()
    console.log(`Syncing with cluster from sequence ${currentSequence}`)

    // Request sync from all connected nodes
    for (const nodeId of connectedNodes) {
      try {
        await this.replicationManager.syncWithNode(nodeId, currentSequence + 1)
      } catch (error) {
        console.warn(`Failed to sync with node ${nodeId}:`, error)
      }
    }
  }

  getReplicationStatus() {
    return this.replicationManager?.getReplicationStatus() || {
      mode: this.options.replication.config.mode,
      role: this.role,
      connectedNodes: 0,
      lastReplicationTime: 0,
      pendingEntries: 0,
      replicationLag: 0
    }
  }

  isReplicationActive(): boolean {
    return this.isReplicationEnabled && !!this.replicationManager
  }

  async enableReplication(): Promise<void> {
    if (this.isReplicationEnabled) {
      return
    }

    this.isReplicationEnabled = true
    this.initializeReplication()
    console.log('Replication enabled')
  }

  async disableReplication(): Promise<void> {
    if (!this.isReplicationEnabled) {
      return
    }

    this.isReplicationEnabled = false
    if (this.replicationManager) {
      await this.replicationManager.close()
      this.replicationManager = undefined
    }
    console.log('Replication disabled')
  }

  // Event emitter methods for replication events
  onEntryReplicated(handler: (entry: WALEntry) => void): void {
    this.on('entryReplicated', handler)
  }

  onEntryReceived(handler: (entry: WALEntry, sourceNode: string) => void): void {
    this.on('entryReceived', handler)
  }

  onReplicationError(handler: (error: Error, entry?: WALEntry) => void): void {
    this.on('replicationError', handler)
  }

  onRoleChanged(handler: (role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE') => void): void {
    this.on('roleChanged', handler)
  }
}