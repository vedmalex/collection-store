/**
 * Raft Log Manager
 * Manages Raft log entries with WAL integration for persistence
 */

import { EventEmitter } from 'events'
import fs from 'fs-extra'
import path from 'path'
import {
  IRaftLogManager,
  RaftLogEntry,
  LogIndex,
  Term,
  NodeId,
  RaftLogError
} from './types'
import { FileWALManager } from '../../wal/FileWALManager'
import { WALEntry } from '../../wal/WALTypes'

export interface RaftLogManagerConfig {
  nodeId: NodeId
  logPath: string
  snapshotPath: string
  snapshotThreshold: number
  enableCompaction: boolean
}

export class RaftLogManager extends EventEmitter implements IRaftLogManager {
  private walManager: FileWALManager
  private entries: RaftLogEntry[] = []
  private commitIndex: LogIndex = 0
  private lastApplied: LogIndex = 0
  private snapshotIndex: LogIndex = 0
  private snapshotTerm: Term = 0
  private config: RaftLogManagerConfig

  constructor(config: RaftLogManagerConfig) {
    super()
    this.config = config

    // Initialize WAL manager for persistence
    this.walManager = new FileWALManager({
      walPath: config.logPath,
      enableChecksums: true,
      flushInterval: 100 // Fast flush for Raft
    })
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.ensureDir(path.dirname(this.config.logPath))
      await fs.ensureDir(path.dirname(this.config.snapshotPath))

      // Recover from existing log
      await this.recover()

      this.emit('initialized')
    } catch (error: any) {
      throw new RaftLogError(`Failed to initialize RaftLogManager: ${error.message}`)
    }
  }

  // Log operations
  async append(entries: RaftLogEntry[]): Promise<void> {
    if (entries.length === 0) return

    try {
      // Validate entries
      this.validateEntries(entries)

      // Convert to WAL entries and persist
      for (const entry of entries) {
        const walEntry = this.toWALEntry(entry)
        await this.walManager.writeEntry(walEntry)
      }

      // Add to in-memory log
      this.entries.push(...entries)

      // Check if compaction is needed
      if (this.config.enableCompaction && this.shouldCompact()) {
        await this.triggerCompaction()
      }

      this.emit('entries_appended', entries)
    } catch (error: any) {
      throw new RaftLogError(`Failed to append entries: ${error.message}`)
    }
  }

  async getEntry(index: LogIndex): Promise<RaftLogEntry | null> {
    try {
      // Check if index is in snapshot
      if (index <= this.snapshotIndex) {
        return null // Entry is compacted
      }

      // Calculate array index (accounting for snapshot)
      const arrayIndex = index - this.snapshotIndex - 1

      if (arrayIndex < 0 || arrayIndex >= this.entries.length) {
        return null
      }

      return this.entries[arrayIndex]
    } catch (error: any) {
      throw new RaftLogError(`Failed to get entry at index ${index}: ${error.message}`)
    }
  }

  async getEntries(startIndex: LogIndex, endIndex?: LogIndex): Promise<RaftLogEntry[]> {
    try {
      const lastIndex = await this.getLastIndex()
      const actualEndIndex = endIndex ?? lastIndex

      if (startIndex > actualEndIndex) {
        return []
      }

      // Check if range is in snapshot
      if (actualEndIndex <= this.snapshotIndex) {
        return []
      }

      // Adjust start index if it's in snapshot
      const adjustedStartIndex = Math.max(startIndex, this.snapshotIndex + 1)

      // Calculate array indices
      const startArrayIndex = adjustedStartIndex - this.snapshotIndex - 1
      const endArrayIndex = actualEndIndex - this.snapshotIndex

      return this.entries.slice(startArrayIndex, endArrayIndex)
    } catch (error: any) {
      throw new RaftLogError(`Failed to get entries [${startIndex}, ${endIndex}]: ${error.message}`)
    }
  }

  // Log metadata
  async getLastIndex(): Promise<LogIndex> {
    return this.snapshotIndex + this.entries.length
  }

  async getLastTerm(): Promise<Term> {
    if (this.entries.length === 0) {
      return this.snapshotTerm
    }
    return this.entries[this.entries.length - 1].term
  }

  async getCommitIndex(): Promise<LogIndex> {
    return this.commitIndex
  }

  async setCommitIndex(index: LogIndex): Promise<void> {
    if (index < this.commitIndex) {
      throw new RaftLogError(`Cannot decrease commit index from ${this.commitIndex} to ${index}`)
    }

    const lastIndex = await this.getLastIndex()
    if (index > lastIndex) {
      throw new RaftLogError(`Commit index ${index} exceeds last index ${lastIndex}`)
    }

    this.commitIndex = index
    this.emit('commit_index_updated', index)
  }

  // Log compaction
  async compact(lastIncludedIndex: LogIndex, lastIncludedTerm: Term): Promise<void> {
    try {
      if (lastIncludedIndex <= this.snapshotIndex) {
        return // Already compacted
      }

      // Calculate how many entries to remove
      const entriesToRemove = lastIncludedIndex - this.snapshotIndex

      if (entriesToRemove > this.entries.length) {
        throw new RaftLogError(`Cannot compact beyond available entries`)
      }

      // Remove compacted entries
      this.entries.splice(0, entriesToRemove)

      // Update snapshot metadata
      this.snapshotIndex = lastIncludedIndex
      this.snapshotTerm = lastIncludedTerm

      // Persist compaction state
      await this.persistCompactionState()

      this.emit('compacted', { lastIncludedIndex, lastIncludedTerm })
    } catch (error: any) {
      throw new RaftLogError(`Failed to compact log: ${error.message}`)
    }
  }

  // Persistence
  async persist(): Promise<void> {
    try {
      await this.walManager.flush()
      await this.persistMetadata()
    } catch (error: any) {
      throw new RaftLogError(`Failed to persist log: ${error.message}`)
    }
  }

  async recover(): Promise<void> {
    try {
      // Recover metadata
      await this.recoverMetadata()

      // Recover WAL entries
      const walEntries = await this.walManager.readEntries()

      // Convert WAL entries back to Raft entries
      this.entries = walEntries
        .filter(entry => entry.operation === 'STORE' && entry.data.raftEntry)
        .map(entry => this.fromWALEntry(entry))
        .filter(entry => entry.index > this.snapshotIndex)

      // Sort by index to ensure order
      this.entries.sort((a, b) => a.index - b.index)

      this.emit('recovered', {
        entriesCount: this.entries.length,
        snapshotIndex: this.snapshotIndex,
        commitIndex: this.commitIndex
      })
    } catch (error: any) {
      throw new RaftLogError(`Failed to recover log: ${error.message}`)
    }
  }

  async close(): Promise<void> {
    try {
      await this.persist()
      await this.walManager.close()
      this.removeAllListeners()
    } catch (error: any) {
      throw new RaftLogError(`Failed to close log manager: ${error.message}`)
    }
  }

  // Helper methods
  private validateEntries(entries: RaftLogEntry[]): void {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      // Validate required fields
      if (typeof entry.term !== 'number' || entry.term < 0) {
        throw new RaftLogError(`Invalid term in entry ${i}: ${entry.term}`)
      }

      if (typeof entry.index !== 'number' || entry.index < 0) {
        throw new RaftLogError(`Invalid index in entry ${i}: ${entry.index}`)
      }

      if (!entry.command || typeof entry.command !== 'object') {
        throw new RaftLogError(`Invalid command in entry ${i}`)
      }

      // Validate sequence
      if (i > 0 && entries[i].index !== entries[i - 1].index + 1) {
        throw new RaftLogError(`Non-sequential indices in entries: ${entries[i - 1].index} -> ${entries[i].index}`)
      }
    }
  }

  private toWALEntry(raftEntry: RaftLogEntry): WALEntry {
    return {
      transactionId: `raft-${raftEntry.index}`,
      sequenceNumber: 0, // Will be assigned by WAL manager
      timestamp: raftEntry.timestamp,
      type: 'DATA',
      collectionName: raftEntry.command.collectionName,
      operation: 'STORE',
      data: {
        key: `raft-entry-${raftEntry.index}`,
        raftEntry: {
          term: raftEntry.term,
          index: raftEntry.index,
          command: raftEntry.command,
          nodeId: raftEntry.nodeId
        }
      },
      checksum: raftEntry.checksum
    }
  }

  private fromWALEntry(walEntry: WALEntry): RaftLogEntry {
    const raftData = walEntry.data.raftEntry as any
    return {
      term: raftData.term,
      index: raftData.index,
      command: raftData.command,
      timestamp: walEntry.timestamp,
      nodeId: raftData.nodeId,
      checksum: walEntry.checksum
    }
  }

  private shouldCompact(): boolean {
    return this.entries.length > this.config.snapshotThreshold
  }

  private async triggerCompaction(): Promise<void> {
    // Only compact committed entries
    if (this.commitIndex > this.snapshotIndex) {
      const compactIndex = Math.min(
        this.commitIndex,
        this.snapshotIndex + Math.floor(this.entries.length / 2)
      )

      const compactTerm = await this.getEntry(compactIndex)
      if (compactTerm) {
        await this.compact(compactIndex, compactTerm.term)
      }
    }
  }

  private async persistMetadata(): Promise<void> {
    const metadata = {
      commitIndex: this.commitIndex,
      lastApplied: this.lastApplied,
      snapshotIndex: this.snapshotIndex,
      snapshotTerm: this.snapshotTerm
    }

    const metadataPath = this.config.logPath + '.metadata'
    await fs.writeJSON(metadataPath, metadata)
  }

  private async recoverMetadata(): Promise<void> {
    const metadataPath = this.config.logPath + '.metadata'

    try {
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJSON(metadataPath)
        this.commitIndex = metadata.commitIndex || 0
        this.lastApplied = metadata.lastApplied || 0
        this.snapshotIndex = metadata.snapshotIndex || 0
        this.snapshotTerm = metadata.snapshotTerm || 0
      }
    } catch (error: any) {
      // If metadata is corrupted, start fresh
      console.warn('Failed to recover metadata, starting fresh:', error.message)
    }
  }

  private async persistCompactionState(): Promise<void> {
    const compactionPath = this.config.logPath + '.compaction'
    const state = {
      snapshotIndex: this.snapshotIndex,
      snapshotTerm: this.snapshotTerm,
      timestamp: Date.now()
    }

    await fs.writeJSON(compactionPath, state)
  }

  // Utility methods for testing and monitoring
  getMetrics() {
    return {
      entriesCount: this.entries.length,
      commitIndex: this.commitIndex,
      lastApplied: this.lastApplied,
      snapshotIndex: this.snapshotIndex,
      snapshotTerm: this.snapshotTerm,
      memoryUsage: this.entries.length * 1024 // Rough estimate
    }
  }

  // For testing
  async reset(): Promise<void> {
    this.entries = []
    this.commitIndex = 0
    this.lastApplied = 0
    this.snapshotIndex = 0
    this.snapshotTerm = 0

    // Clear WAL file
    try {
      await fs.remove(this.config.logPath)
      await fs.remove(this.config.logPath + '.metadata')
      await fs.remove(this.config.logPath + '.compaction')
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
}