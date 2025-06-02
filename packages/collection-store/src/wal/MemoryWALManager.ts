/**
 * Memory-based WAL Manager Implementation
 * Реализация WAL Manager для тестирования в памяти
 */

import crypto from 'crypto'
import { IWALManager, WALEntry, WALCheckpoint, WALManagerOptions } from './WALTypes'

export class MemoryWALManager implements IWALManager {
  private entries: WALEntry[] = []
  private sequenceCounter: number = 0
  private options: Required<WALManagerOptions>
  private closed = false

  constructor(options: WALManagerOptions = {}) {
    this.options = {
      walPath: options.walPath || ':memory:',
      flushInterval: options.flushInterval || 0, // No flush timer for memory
      maxBufferSize: options.maxBufferSize || 1000,
      enableCompression: options.enableCompression || false,
      enableChecksums: options.enableChecksums || true
    }
  }

  async writeEntry(entry: WALEntry): Promise<void> {
    if (this.closed) {
      throw new Error('WAL Manager is closed')
    }

    // Assign sequence number
    entry.sequenceNumber = ++this.sequenceCounter

    // Calculate checksum if enabled
    if (this.options.enableChecksums) {
      entry.checksum = this.calculateChecksum(entry)
    }

    // Store in memory
    this.entries.push({ ...entry })
  }

  async readEntries(fromSequence: number = 0): Promise<WALEntry[]> {
    return this.entries
      .filter(entry => entry.sequenceNumber >= fromSequence)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map(entry => ({ ...entry })) // Return copies
  }

  async truncate(beforeSequence: number): Promise<void> {
    this.entries = this.entries.filter(entry => entry.sequenceNumber >= beforeSequence)
  }

  async flush(): Promise<void> {
    // No-op for memory implementation
  }

  async recover(): Promise<void> {
    console.log('Starting memory WAL recovery...')

    const transactions = new Map<string, WALEntry[]>()

    // Group entries by transaction
    for (const entry of this.entries) {
      if (!transactions.has(entry.transactionId)) {
        transactions.set(entry.transactionId, [])
      }
      transactions.get(entry.transactionId)!.push(entry)
    }

    let recoveredTransactions = 0
    let rolledBackTransactions = 0

    // Process each transaction
    for (const [txId, txEntries] of transactions) {
      const hasCommit = txEntries.some(e => e.type === 'COMMIT')
      const hasRollback = txEntries.some(e => e.type === 'ROLLBACK')

      if (hasCommit && !hasRollback) {
        // Transaction was committed, replay if needed
        await this.replayTransaction(txId, txEntries)
        recoveredTransactions++
      } else if (hasRollback || !hasCommit) {
        // Transaction was rolled back or incomplete, ensure rollback
        await this.rollbackTransaction(txId, txEntries)
        rolledBackTransactions++
      }
    }

    console.log(`Memory WAL recovery completed: ${recoveredTransactions} recovered, ${rolledBackTransactions} rolled back`)
  }

  async createCheckpoint(): Promise<WALCheckpoint> {
    const checkpoint: WALCheckpoint = {
      checkpointId: crypto.randomUUID(),
      timestamp: Date.now(),
      sequenceNumber: 0, // Will be set after writing checkpoint entry
      transactionIds: [] // Will be populated by transaction manager
    }

    // Write checkpoint marker to WAL
    await this.writeEntry({
      transactionId: 'CHECKPOINT',
      sequenceNumber: 0, // Will be assigned by writeEntry
      timestamp: checkpoint.timestamp,
      type: 'DATA',
      collectionName: '*',
      operation: 'COMMIT',
      data: { key: 'checkpoint', checkpointId: checkpoint.checkpointId },
      checksum: ''
    })

    // Update checkpoint with current sequence number
    checkpoint.sequenceNumber = this.sequenceCounter

    return checkpoint
  }

  getCurrentSequence(): number {
    return this.sequenceCounter
  }

  async close(): Promise<void> {
    this.closed = true
    // Clear memory
    this.entries = []
  }

  // Additional methods for testing
  getEntriesCount(): number {
    return this.entries.length
  }

  clear(): void {
    this.entries = []
    this.sequenceCounter = 0
  }

  private calculateChecksum(entry: WALEntry): string {
    // Create a copy without checksum for calculation
    const entryForChecksum = { ...entry, checksum: '' }
    const data = JSON.stringify(entryForChecksum)
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  private async replayTransaction(transactionId: string, entries: WALEntry[]): Promise<void> {
    console.log(`Replaying memory transaction ${transactionId} with ${entries.length} entries`)

    // Sort entries by sequence number
    entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

    // Replay data operations
    for (const entry of entries) {
      if (entry.type === 'DATA') {
        // This would be handled by the specific storage adapters
        // For now, just log the operation
        console.log(`Memory Replay: ${entry.operation} on ${entry.collectionName}`)
      }
    }
  }

  private async rollbackTransaction(transactionId: string, entries: WALEntry[]): Promise<void> {
    console.log(`Rolling back memory transaction ${transactionId}`)

    // Sort entries by sequence number (reverse for rollback)
    entries.sort((a, b) => b.sequenceNumber - a.sequenceNumber)

    // Rollback data operations
    for (const entry of entries) {
      if (entry.type === 'DATA') {
        // This would be handled by the specific storage adapters
        // For now, just log the operation
        console.log(`Memory Rollback: ${entry.operation} on ${entry.collectionName}`)
      }
    }
  }
}