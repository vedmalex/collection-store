/**
 * File-based WAL Manager Implementation
 * Реализация WAL Manager для файлового хранения
 */

import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { IWALManager, WALEntry, WALCheckpoint, WALManagerOptions } from './WALTypes'

export class FileWALManager implements IWALManager {
  private walFile: string
  private sequenceCounter: number = 0
  private writeBuffer: WALEntry[] = []
  private flushTimer?: NodeJS.Timeout
  private options: Required<WALManagerOptions>
  private closed = false

  constructor(options: WALManagerOptions = {}) {
    this.options = {
      walPath: options.walPath || './data/wal.log',
      flushInterval: options.flushInterval || 1000, // 1 second
      maxBufferSize: options.maxBufferSize || 100,
      enableCompression: options.enableCompression || false,
      enableChecksums: options.enableChecksums || true
    }

    this.walFile = this.options.walPath
    this.initializeWAL()
    this.startFlushTimer()
  }

  private async initializeWAL(): Promise<void> {
    // Ensure WAL directory exists
    await fs.ensureDir(path.dirname(this.walFile))

    // Read existing WAL to get current sequence number
    if (await fs.pathExists(this.walFile)) {
      const entries = await this.readEntries()
      if (entries.length > 0) {
        this.sequenceCounter = Math.max(...entries.map(e => e.sequenceNumber))
      }
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(async () => {
      if (this.writeBuffer.length > 0) {
        await this.flush()
      }
    }, this.options.flushInterval)
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

    this.writeBuffer.push(entry)

    // Flush immediately for critical entries or if buffer is full
    if (entry.type === 'COMMIT' || entry.type === 'ROLLBACK' ||
        this.writeBuffer.length >= this.options.maxBufferSize) {
      await this.flush()
    }
  }

  async readEntries(fromSequence: number = 0): Promise<WALEntry[]> {
    if (!(await fs.pathExists(this.walFile))) {
      return []
    }

    const content = await fs.readFile(this.walFile, 'utf8')
    const lines = content.split('\n').filter(line => line.trim())

    const entries: WALEntry[] = []

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as WALEntry

        // Validate checksum if enabled
        if (this.options.enableChecksums && entry.checksum) {
          const expectedChecksum = this.calculateChecksum(entry)
          if (entry.checksum !== expectedChecksum) {
            console.warn(`WAL entry checksum mismatch for sequence ${entry.sequenceNumber}`)
            continue
          }
        }

        if (entry.sequenceNumber >= fromSequence) {
          entries.push(entry)
        }
      } catch (error) {
        console.warn(`Failed to parse WAL entry: ${line}`, error)
      }
    }

    return entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }

  async truncate(beforeSequence: number): Promise<void> {
    const entries = await this.readEntries(beforeSequence)

    if (entries.length === 0) {
      // Remove entire WAL file
      if (await fs.pathExists(this.walFile)) {
        await fs.remove(this.walFile)
      }
      return
    }

    // Rewrite WAL with remaining entries
    const walData = entries.map(e => JSON.stringify(e)).join('\n') + '\n'
    await fs.writeFile(this.walFile, walData, 'utf8')
  }

  async flush(): Promise<void> {
    if (this.writeBuffer.length === 0) return

    const entries = this.writeBuffer.splice(0)
    const walData = entries.map(e => JSON.stringify(e)).join('\n') + '\n'

    await fs.appendFile(this.walFile, walData, 'utf8')
  }

  async recover(): Promise<void> {
    console.log('Starting WAL recovery...')

    const entries = await this.readEntries()
    const transactions = new Map<string, WALEntry[]>()

    // Group entries by transaction
    for (const entry of entries) {
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

    console.log(`WAL recovery completed: ${recoveredTransactions} recovered, ${rolledBackTransactions} rolled back`)
  }

  async createCheckpoint(): Promise<WALCheckpoint> {
    await this.flush()

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

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }

    // Final flush
    await this.flush()
  }

  private calculateChecksum(entry: WALEntry): string {
    // Create a copy without checksum for calculation
    const entryForChecksum = { ...entry, checksum: '' }
    const data = JSON.stringify(entryForChecksum)
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  private async replayTransaction(transactionId: string, entries: WALEntry[]): Promise<void> {
    console.log(`Replaying transaction ${transactionId} with ${entries.length} entries`)

    // Sort entries by sequence number
    entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

    // Replay data operations
    for (const entry of entries) {
      if (entry.type === 'DATA') {
        // This would be handled by the specific storage adapters
        // For now, just log the operation
        console.log(`Replay: ${entry.operation} on ${entry.collectionName}`)
      }
    }
  }

  private async rollbackTransaction(transactionId: string, entries: WALEntry[]): Promise<void> {
    console.log(`Rolling back transaction ${transactionId}`)

    // Sort entries by sequence number (reverse for rollback)
    entries.sort((a, b) => b.sequenceNumber - a.sequenceNumber)

    // Rollback data operations
    for (const entry of entries) {
      if (entry.type === 'DATA') {
        // This would be handled by the specific storage adapters
        // For now, just log the operation
        console.log(`Rollback: ${entry.operation} on ${entry.collectionName}`)
      }
    }
  }
}