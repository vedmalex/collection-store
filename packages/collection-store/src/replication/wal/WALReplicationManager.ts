/**
 * WAL Replication Manager
 * Управляет репликацией WAL entries между узлами кластера
 */

import { EventEmitter } from 'events'
import { IWALManager, WALEntry } from '../../wal/WALTypes'
import {
  INetworkManager,
  IReplicationManager,
  ReplicationMessage,
  ReplicationConfig,
  ReplicationStatus
} from '../types/ReplicationTypes'

export class WALReplicationManager extends EventEmitter implements IReplicationManager {
  private walManager: IWALManager
  private networkManager: INetworkManager
  private replicationConfig: ReplicationConfig
  private pendingEntries = new Map<number, WALEntry>()
  private acknowledgments = new Map<string, Set<string>>() // messageId -> nodeIds
  private replicationStatus: ReplicationStatus
  private syncTimeouts = new Map<string, NodeJS.Timeout>()

  constructor(
    walManager: IWALManager,
    networkManager: INetworkManager,
    config: ReplicationConfig
  ) {
    super()
    this.walManager = walManager
    this.networkManager = networkManager
    this.replicationConfig = config

    this.replicationStatus = {
      mode: config.mode,
      role: 'FOLLOWER', // Will be updated by consensus manager
      connectedNodes: 0,
      lastReplicationTime: Date.now(),
      pendingEntries: 0,
      replicationLag: 0
    }

    this.setupMessageHandlers()
    this.startStatusUpdater()
  }

  private setupMessageHandlers(): void {
    this.networkManager.onMessage((message: ReplicationMessage) => {
      switch (message.type) {
        case 'WAL_ENTRY':
          this.handleWALEntry(message)
          break
        case 'SYNC_REQUEST':
          this.handleSyncRequest(message)
          break
        case 'ACK':
          this.handleAcknowledgment(message)
          break
        default:
          // Other message types handled by consensus manager
          break
      }
    })

    this.networkManager.on('nodeConnected', (nodeId: string) => {
      this.replicationStatus.connectedNodes = this.networkManager.getConnectedNodes().length
      this.emit('nodeConnected', nodeId)
    })

    this.networkManager.on('nodeDisconnected', (nodeId: string) => {
      this.replicationStatus.connectedNodes = this.networkManager.getConnectedNodes().length
      this.cleanupNodeData(nodeId)
      this.emit('nodeDisconnected', nodeId)
    })
  }

  private startStatusUpdater(): void {
    setInterval(() => {
      this.updateReplicationStatus()
    }, 5000) // Update every 5 seconds
  }

  private updateReplicationStatus(): void {
    this.replicationStatus.pendingEntries = this.pendingEntries.size
    this.replicationStatus.connectedNodes = this.networkManager.getConnectedNodes().length

    // Calculate replication lag (simplified)
    const now = Date.now()
    const lagSum = Array.from(this.pendingEntries.values())
      .reduce((sum, entry) => sum + (now - entry.timestamp), 0)

    this.replicationStatus.replicationLag = this.pendingEntries.size > 0
      ? lagSum / this.pendingEntries.size
      : 0
  }

  async streamWALEntry(entry: WALEntry): Promise<void> {
    if (this.replicationStatus.role !== 'LEADER') {
      // Only leaders stream entries
      return
    }

    const message: ReplicationMessage = {
      type: 'WAL_ENTRY',
      sourceNodeId: this.networkManager.nodeId,
      timestamp: Date.now(),
      data: entry,
      checksum: '',
      messageId: `wal-${entry.sequenceNumber}-${Date.now()}`
    }

    try {
      if (this.replicationConfig.syncMode === 'SYNC') {
        await this.replicateSync(message)
      } else {
        await this.replicateAsync(message)
      }

      this.replicationStatus.lastReplicationTime = Date.now()
      this.emit('entryReplicated', entry)

    } catch (error) {
      console.error(`Failed to replicate WAL entry ${entry.sequenceNumber}:`, error)
      this.emit('replicationError', error, entry)
      throw error
    }
  }

  private async replicateSync(message: ReplicationMessage): Promise<void> {
    const connectedNodes = this.networkManager.getConnectedNodes()
    if (connectedNodes.length === 0) {
      return // No nodes to replicate to
    }

    // Calculate required acknowledgments (majority)
    const requiredAcks = Math.floor(connectedNodes.length / 2) + 1

    // Initialize acknowledgment tracking
    this.acknowledgments.set(message.messageId, new Set())

    // Send to all nodes
    await this.networkManager.broadcastMessage(message)

    // Wait for acknowledgments with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.acknowledgments.delete(message.messageId)
        reject(new Error(`Sync replication timeout for message ${message.messageId}`))
      }, this.replicationConfig.asyncTimeout)

      // Check acknowledgments periodically
      const checkAcks = setInterval(() => {
        const acks = this.acknowledgments.get(message.messageId)
        if (acks && acks.size >= requiredAcks) {
          clearTimeout(timeout)
          clearInterval(checkAcks)
          this.acknowledgments.delete(message.messageId)
          resolve()
        }
      }, 100) // Check every 100ms
    })
  }

  private async replicateAsync(message: ReplicationMessage): Promise<void> {
    // Add to pending queue for retry mechanism
    if (message.data && message.data.sequenceNumber) {
      this.pendingEntries.set(message.data.sequenceNumber, message.data)
    }

    // Broadcast to all nodes (fire and forget)
    await this.networkManager.broadcastMessage(message)

    // Remove from pending after timeout
    setTimeout(() => {
      if (message.data && message.data.sequenceNumber) {
        this.pendingEntries.delete(message.data.sequenceNumber)
      }
    }, this.replicationConfig.asyncTimeout)
  }

  async receiveWALEntry(entry: WALEntry, sourceNode: string): Promise<void> {
    if (this.replicationStatus.role === 'LEADER') {
      console.warn(`Leader node received WAL entry from ${sourceNode}, ignoring`)
      return
    }

    try {
      // Validate entry
      if (!this.validateWALEntry(entry)) {
        throw new Error(`Invalid WAL entry from ${sourceNode}`)
      }

      // Apply entry locally
      await this.walManager.writeEntry(entry)

      // Note: Acknowledgment is now sent in handleWALEntry with correct messageId

      this.replicationStatus.lastReplicationTime = Date.now()
      this.emit('entryReceived', entry, sourceNode)

    } catch (error) {
      console.error(`Failed to receive WAL entry from ${sourceNode}:`, error)
      this.emit('replicationError', error, entry)
      throw error
    }
  }

  private async handleWALEntry(message: ReplicationMessage): Promise<void> {
    try {
      const entry = message.data as WALEntry
      await this.receiveWALEntry(entry, message.sourceNodeId)

      // Send acknowledgment for sync replication with correct messageId
      if (this.replicationConfig.syncMode === 'SYNC') {
        await this.sendAcknowledgmentForMessage(message.sourceNodeId, message.messageId, entry)
      }
    } catch (error) {
      console.error(`Error handling WAL entry from ${message.sourceNodeId}:`, error)
    }
  }

  private async handleSyncRequest(message: ReplicationMessage): Promise<void> {
    const { fromSequence } = message.data

    try {
      // Get entries from WAL starting from requested sequence
      const entries = await this.walManager.readEntries(fromSequence)

      // Send entries in batches to avoid large messages
      const batchSize = 100
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize)

        for (const entry of batch) {
          const walMessage: ReplicationMessage = {
            type: 'WAL_ENTRY',
            sourceNodeId: this.networkManager.nodeId,
            targetNodeId: message.sourceNodeId,
            timestamp: Date.now(),
            data: entry,
            checksum: '',
            messageId: `sync-${entry.sequenceNumber}-${Date.now()}`
          }

          await this.networkManager.sendMessage(message.sourceNodeId, walMessage)
        }

        // Small delay between batches to avoid overwhelming
        if (i + batchSize < entries.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      console.log(`Sent ${entries.length} WAL entries to ${message.sourceNodeId} for sync`)

    } catch (error) {
      console.error(`Failed to handle sync request from ${message.sourceNodeId}:`, error)
    }
  }

  private async handleAcknowledgment(message: ReplicationMessage): Promise<void> {
    const { originalMessageId } = message.data
    const acks = this.acknowledgments.get(originalMessageId)

    if (acks) {
      acks.add(message.sourceNodeId)
    }
  }

  private async sendAcknowledgmentForMessage(targetNode: string, originalMessageId: string, entry: WALEntry): Promise<void> {
    const ackMessage: ReplicationMessage = {
      type: 'ACK',
      sourceNodeId: this.networkManager.nodeId,
      targetNodeId: targetNode,
      timestamp: Date.now(),
      data: {
        originalMessageId: originalMessageId,
        sequenceNumber: entry.sequenceNumber
      },
      checksum: '',
      messageId: `ack-${entry.sequenceNumber}-${Date.now()}`
    }

    await this.networkManager.sendMessage(targetNode, ackMessage)
  }

  async syncWithNode(nodeId: string, fromSequence: number = 0): Promise<void> {
    const message: ReplicationMessage = {
      type: 'SYNC_REQUEST',
      sourceNodeId: this.networkManager.nodeId,
      targetNodeId: nodeId,
      timestamp: Date.now(),
      data: { fromSequence },
      checksum: '',
      messageId: `sync-req-${Date.now()}`
    }

    await this.networkManager.sendMessage(nodeId, message)
    console.log(`Requested sync from node ${nodeId} starting from sequence ${fromSequence}`)
  }

  private validateWALEntry(entry: WALEntry): boolean {
    return !!(
      entry &&
      entry.transactionId &&
      entry.sequenceNumber >= 0 &&
      entry.timestamp &&
      entry.type &&
      entry.operation &&
      entry.data
    )
  }

  private cleanupNodeData(nodeId: string): void {
    // Remove acknowledgments from disconnected node
    for (const [, acks] of this.acknowledgments) {
      acks.delete(nodeId)
    }

    // Clear any sync timeouts for this node
    const timeout = this.syncTimeouts.get(nodeId)
    if (timeout) {
      clearTimeout(timeout)
      this.syncTimeouts.delete(nodeId)
    }
  }

  getReplicationStatus(): ReplicationStatus {
    return { ...this.replicationStatus }
  }

  setRole(role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'): void {
    this.replicationStatus.role = role
    this.emit('roleChanged', role)
  }

  async retryFailedReplications(): Promise<void> {
    if (this.pendingEntries.size === 0) {
      return
    }

    console.log(`Retrying ${this.pendingEntries.size} failed replications`)

    for (const [sequenceNumber, entry] of this.pendingEntries) {
      try {
        await this.streamWALEntry(entry)
        this.pendingEntries.delete(sequenceNumber)
      } catch (error) {
        console.warn(`Retry failed for entry ${sequenceNumber}:`, error)
      }
    }
  }

  async close(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.syncTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.syncTimeouts.clear()

    // Clear pending data
    this.pendingEntries.clear()
    this.acknowledgments.clear()

    this.removeAllListeners()
    console.log(`WALReplicationManager closed for node ${this.networkManager.nodeId}`)
  }
}